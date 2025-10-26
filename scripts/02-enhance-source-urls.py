#!/usr/bin/env python3
"""
Enhance source URLs in GPT-combined data using ChatGPT API.

Unix filter: reads JSON from stdin, writes JSON to stdout.
Diagnostic messages go to stderr.

Problems to fix:
1. Null or empty sourceUrl fields
2. Generic status page URLs that won't be stable long-term

Solution:
- Use ChatGPT API to find specific, stable primary sources
- Validate that URLs are accessible and relevant
- Update the data with enhanced sources

Usage:
    cat data/gpt-combined.json | python3 scripts/02-enhance-source-urls.py > data/gpt-enhanced.json
"""

import json
import sys
import subprocess
from typing import Dict, List, Any, Optional
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
import requests
from urllib.parse import urlparse

# Set up log file with timestamp
LOG_FILE = Path(__file__).parent.parent / "logs" / f"enhance-urls-{datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
LOG_FILE.parent.mkdir(exist_ok=True)

# Generic status page patterns that need enhancement
GENERIC_PATTERNS = [
    "status.",  # status.example.com
    "/status",  # example.com/status
    "/health",  # health dashboards
    "support.",  # support pages
]

def log(msg: str) -> None:
    """Log to file (append mode) and stderr."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] {msg}"

    # Write to log file (append)
    with open(LOG_FILE, 'a') as f:
        f.write(log_line + "\n")

    # Also print to stderr for real-time monitoring
    print(msg, file=sys.stderr)

def is_problematic_url(url: Optional[str]) -> bool:
    """Check if URL is null, empty, or generic."""
    if not url:
        return True

    url_lower = url.lower()

    # Check for generic patterns
    for pattern in GENERIC_PATTERNS:
        if pattern in url_lower:
            # Allow if it has query params or specific path segments
            parsed = urlparse(url)
            if not parsed.query and url_lower.endswith(pattern.rstrip("/")):
                return True

    return False

def call_claude(prompt: str) -> Optional[str]:
    """Call local claude CLI with WebSearch to get source URL suggestion."""

    try:
        result = subprocess.run(
            ['claude', '--print', '--allowed-tools', 'WebSearch', '--permission-mode', 'bypassPermissions', '--debug', '!hooks'],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=1200  # 20 minute wall-clock timeout per query
        )

        output = result.stdout.strip()

        # Check for credit/error messages
        if result.returncode != 0 or not output or "credit" in output.lower():
            log(f"⚠️  claude CLI error (rc={result.returncode}):")
            if result.stderr:
                log(f"     stderr: {result.stderr[:200]}")
            if output:
                log(f"     stdout: {output[:200]}")
            return None

        return output

    except subprocess.TimeoutExpired:
        log("⚠️  claude CLI timeout")
        return None
    except Exception as e:
        log(f"⚠️  claude CLI error: {e}")
        return None

def validate_url(url: str, keywords: List[str]) -> bool:
    """Validate that URL is accessible and contains relevant keywords."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; US-EAST-1-Tracker/1.0)"
        }
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)

        if response.status_code != 200:
            return False

        # Check if content contains at least one keyword
        content_lower = response.text.lower()
        return any(keyword.lower() in content_lower for keyword in keywords)

    except:
        return False

def enhance_event_source(event: Dict[str, Any]) -> Dict[str, Any]:
    """Enhance source URLs for an event."""

    log(f"\n🔍 Enhancing event: {event['id']}")

    for source in event.get("sources", []):
        url = source.get("url")

        if is_problematic_url(url):
            log(f"   Problematic URL: {url or 'null'}")

            # Build prompt for Claude with WebSearch
            prompt = f"""Search the web for a primary source URL documenting the AWS US-EAST-1 outage on October 20, 2025.

Event: {event['title']}
Description: {event['description']}
AWS Services: {', '.join(event['awsServicesAffected'])}

Find the BEST URL that:
1. Will be valid long-term (not just a status homepage)
2. Is an official AWS post-mortem, incident report, or major news article
3. Contains specific identifiers (date, incident ID)

Reply with the single best URL on its own line at the end of your response."""

            result = call_claude(prompt)

            if result:
                log(f"   Claude returned: {result[:200]}...")

                if result != "NONE":
                    # Extract URL from Claude's response (may be verbose)
                    lines = result.split("\n")
                    potential_url = None
                    # Try last line first (where we asked it to put the URL)
                    for line in reversed(lines):
                        line = line.strip()
                        if line.startswith("http"):
                            potential_url = line
                            break

                    if potential_url:
                        log(f"   Extracted URL: {potential_url}")

                        # Validate
                        keywords = event['awsServicesAffected'] + ["AWS", "outage", "US-EAST-1"]
                        log(f"   Validating with keywords: {keywords}")
                        if validate_url(potential_url, keywords):
                            source["url"] = potential_url
                            log(f"   ✅ Validated and updated")
                        else:
                            log(f"   ⚠️  Validation failed, keeping original")
                    else:
                        log(f"   ⚠️  No URL found in response")
                else:
                    log(f"   Claude returned NONE")
            else:
                log(f"   ⚠️  No response from Claude")

    return event

def enhance_impact_source(impact: Dict[str, Any], event_context: Dict[str, Any], all_services: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Enhance source URL for an event impact."""

    url = impact.get("sourceUrl")

    if is_problematic_url(url):
        service_id = impact['serviceId']
        feature_id = impact['featureId']
        impact_type = impact['impactType']
        description = impact['description']

        # Find the service details for better context
        service = next((s for s in all_services if s['id'] == service_id), None)
        service_name = service['name'] if service else service_id
        company = service['company'] if service else 'Unknown'
        feature_name = None
        if service:
            feature = next((f for f in service.get('features', []) if f['id'] == feature_id), None)
            feature_name = feature['name'] if feature else feature_id

        log(f"   {service_name}/{feature_name or feature_id}: {url or 'null'}")

        # Build prompt with MUCH more context
        prompt = f"""Search the web for documentation that {service_name} (company: {company}) was impacted during the AWS US-EAST-1 outage on October 20, 2025.

BACKGROUND: On October 20, 2025, AWS US-EAST-1 region had a major outage affecting DynamoDB, Route53, and other services. This caused widespread impact on hundreds of internet services and apps.

SERVICE DETAILS:
- Service: {service_name} (ID: {service_id})
- Company: {company}
- Feature affected: {feature_name or feature_id}
- Impact type: {impact_type}
- What happened: {description}

TASK: Search for and find the BEST URL that documents this specific impact. Look for:
1. Official {company} status page with this specific October 20, 2025 incident
2. News articles from TechCrunch, The Verge, Ars Technica, etc. mentioning "{service_name}" and "AWS outage" October 2025
3. Reddit threads, Twitter/X posts from official {company} account about the outage
4. DownDetector or similar service tracking sites

IMPORTANT: The URL must be PERMANENT (not just homepage). If you find something, reply with ONLY the URL on the last line."""

        result = call_claude(prompt)

        if result:
            log(f"      Claude full response:\n{result}\n")

            if result != "NONE":
                lines = result.split("\n")
                potential_url = None
                # Try last line first (where we asked it to put the URL)
                for line in reversed(lines):
                    line = line.strip()
                    if line.startswith("http"):
                        potential_url = line
                        break

                if potential_url:
                    log(f"      Found: {potential_url[:70]}")
                    keywords = [service_id.replace("-", " "), impact_type, "AWS", "outage"]
                    if validate_url(potential_url, keywords):
                        impact["sourceUrl"] = potential_url
                        log(f"      ✅ Validated")
                    else:
                        log(f"      ⚠️  Validation failed (keywords: {keywords})")
                else:
                    log(f"      ⚠️  No URL in response")
            else:
                log(f"      Claude: NONE")
        else:
            log(f"      ⚠️  No response")

    return impact

def main() -> None:
    """Main function - Unix filter stdin to stdout."""

    log(f"📝 Logging to: {LOG_FILE}")
    log("📖 Reading JSON from stdin...")
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        log(f"❌ Invalid JSON on stdin: {e}")
        sys.exit(1)

    total_events = len(data.get("events", []))
    total_impacts = len(data.get("eventImpacts", []))

    log(f"\n📊 Found {total_events} events and {total_impacts} event impacts")

    # Count problematic URLs
    problematic_event_sources = 0
    problematic_impacts = 0

    for event in data.get("events", []):
        for source in event.get("sources", []):
            if is_problematic_url(source.get("url")):
                problematic_event_sources += 1

    for impact in data.get("eventImpacts", []):
        if is_problematic_url(impact.get("sourceUrl")):
            problematic_impacts += 1

    log(f"   Problematic event sources: {problematic_event_sources}")
    log(f"   Problematic impact sources: {problematic_impacts}")

    # Enhance events
    log(f"\n🔧 Enhancing event sources...")
    for event in data.get("events", []):
        enhance_event_source(event)

    # Enhance event impacts in parallel
    log(f"\n🔧 Enhancing event impact sources (parallel)...")
    event_context = data["events"][0] if data.get("events") else {}
    all_services = data.get("services", [])

    impacts = data.get("eventImpacts", [])
    log(f"   Processing {len(impacts)} impacts...")
    completed_count = 0

    with ProcessPoolExecutor(max_workers=100) as executor:
        # Submit all tasks
        future_to_index = {
            executor.submit(enhance_impact_source, impact, event_context, all_services): i
            for i, impact in enumerate(impacts)
        }

        # Process as they complete and update the data
        for future in as_completed(future_to_index):
            index = future_to_index[future]
            enhanced_impact = future.result()
            data["eventImpacts"][index] = enhanced_impact

            completed_count += 1
            if completed_count % 10 == 0:
                log(f"   Progress: {completed_count}/{total_impacts}")

    # Write to stdout
    log(f"\n💾 Writing enhanced JSON to stdout...")
    json.dump(data, sys.stdout, indent=2)
    log(f"\n✅ Done!")

if __name__ == "__main__":
    main()
