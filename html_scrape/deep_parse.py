#!/usr/bin/env python3
"""Deep HTML parser for beast.travel trip pages - looking for hidden text in captions."""

from html.parser import HTMLParser
import re
import os

class DeepHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.results = {
            'comments': [],
            'images': [],
            'figcaptions': [],
            'hidden_elements': [],
            'all_text_with_context': [],
            'data_attributes': [],
            'links': [],
            'styled_text': [],
            'sr_only': [],
            'aria_labels': [],
        }
        self.tag_stack = []
        self.current_attrs = {}
        self.in_figcaption = False
        self.figcaption_html = ""
        self.in_hidden = False
        self.current_classes = []
        self.capture_text = False
        self.text_context = ""

    def handle_comment(self, data):
        self.results['comments'].append(data.strip())

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        self.tag_stack.append((tag, attr_dict))
        classes = attr_dict.get('class', '')

        # Track figcaptions
        if tag == 'figcaption':
            self.in_figcaption = True
            self.figcaption_html = ""
            self.figcaption_attrs = attr_dict

        # Track images
        if tag == 'img':
            self.results['images'].append({
                'src': attr_dict.get('src', ''),
                'alt': attr_dict.get('alt', ''),
                'title': attr_dict.get('title', ''),
                'class': attr_dict.get('class', ''),
                'data_attrs': {k: v for k, v in attr_dict.items() if k.startswith('data-')},
                'width': attr_dict.get('width', ''),
                'height': attr_dict.get('height', ''),
                'srcset': attr_dict.get('srcset', ''),
            })

        # Track links
        if tag == 'a':
            self.results['links'].append({
                'href': attr_dict.get('href', ''),
                'title': attr_dict.get('title', ''),
                'class': attr_dict.get('class', ''),
                'aria_label': attr_dict.get('aria-label', ''),
            })

        # Track hidden/sr-only elements
        if 'sr-only' in classes or 'screen-reader' in classes or 'visually-hidden' in classes:
            self.results['sr_only'].append({'tag': tag, 'attrs': attr_dict})
            self.in_hidden = True

        # Check for hidden via style
        style = attr_dict.get('style', '')
        if 'display:none' in style.replace(' ', '') or 'visibility:hidden' in style.replace(' ', '') or 'opacity:0' in style.replace(' ', ''):
            self.results['hidden_elements'].append({'tag': tag, 'attrs': attr_dict})
            self.in_hidden = True

        # Track data attributes
        for key, value in attr_dict.items():
            if key.startswith('data-'):
                self.results['data_attributes'].append({
                    'tag': tag, 'attr': key, 'value': value,
                    'class': attr_dict.get('class', '')
                })

        # Track aria-labels
        if 'aria-label' in attr_dict:
            self.results['aria_labels'].append({
                'tag': tag, 'label': attr_dict['aria-label'],
                'class': attr_dict.get('class', '')
            })

        # Track styled text elements (bold, italic, colored, etc.)
        if tag in ('strong', 'b', 'em', 'i', 'mark', 'u', 'strike', 'del', 'ins', 'sub', 'sup', 'span'):
            self.capture_text = True
            self.text_context = f"<{tag}"
            if 'style' in attr_dict:
                self.text_context += f' style="{attr_dict["style"]}"'
            if 'class' in attr_dict:
                self.text_context += f' class="{attr_dict["class"]}"'
            self.text_context += ">"

    def handle_endtag(self, tag):
        if tag == 'figcaption':
            self.in_figcaption = False
            self.results['figcaptions'].append({
                'html': self.figcaption_html.strip(),
                'attrs': getattr(self, 'figcaption_attrs', {})
            })

        if self.tag_stack:
            self.tag_stack.pop()

        if self.capture_text and tag in ('strong', 'b', 'em', 'i', 'mark', 'u', 'strike', 'del', 'ins', 'sub', 'sup', 'span'):
            self.capture_text = False

    def handle_data(self, data):
        text = data.strip()
        if not text:
            return

        if self.in_figcaption:
            self.figcaption_html += data

        if self.in_hidden:
            self.results['hidden_elements'].append({'text': text})
            self.in_hidden = False

        if self.capture_text:
            self.results['styled_text'].append({
                'context': self.text_context,
                'text': text
            })

        # Track all text with parent tag context
        parent = self.tag_stack[-1] if self.tag_stack else ('root', {})
        if text and parent[0] not in ('script', 'style', 'noscript'):
            self.results['all_text_with_context'].append({
                'tag': parent[0],
                'class': parent[1].get('class', ''),
                'style': parent[1].get('style', ''),
                'text': text
            })


def parse_page(filename):
    print(f"\n{'='*80}")
    print(f"PARSING: {filename}")
    print(f"{'='*80}")

    with open(filename, 'r', encoding='utf-8') as f:
        html = f.read()

    parser = DeepHTMLParser()
    parser.feed(html)
    r = parser.results

    # 1. HTML Comments
    print(f"\n--- HTML COMMENTS ({len(r['comments'])}) ---")
    for c in r['comments']:
        if len(c) < 500 and not c.startswith('!') and 'elementor' not in c.lower() and 'wp-' not in c:
            print(f"  COMMENT: {c[:200]}")

    # 2. Images - focus on alt text and filenames
    print(f"\n--- IMAGES WITH ALT TEXT ({len(r['images'])}) ---")
    for img in r['images']:
        src = img['src']
        alt = img['alt']
        title = img['title']
        # Only show content images (not theme/elementor images)
        if alt or 'beast.travel' in src or 'wp-content/uploads' in src:
            filename_part = src.split('/')[-1] if src else ''
            print(f"  ALT: '{alt}' | TITLE: '{title}' | FILE: {filename_part}")
            if img['data_attrs']:
                print(f"    DATA-ATTRS: {img['data_attrs']}")

    # 3. Figcaptions - THE KEY DATA
    print(f"\n--- FIGCAPTIONS ({len(r['figcaptions'])}) ---")
    for fig in r['figcaptions']:
        print(f"  FIGCAPTION HTML: {fig['html']}")
        if fig['attrs']:
            print(f"    ATTRS: {fig['attrs']}")

    # 4. Hidden elements
    print(f"\n--- HIDDEN/SR-ONLY ELEMENTS ---")
    for h in r['hidden_elements']:
        print(f"  HIDDEN: {h}")
    for s in r['sr_only']:
        print(f"  SR-ONLY: {s}")

    # 5. Styled text
    print(f"\n--- STYLED TEXT (bold/italic/colored/span) ---")
    for s in r['styled_text']:
        print(f"  {s['context']} -> '{s['text']}'")

    # 6. Aria labels
    if r['aria_labels']:
        print(f"\n--- ARIA LABELS ---")
        for a in r['aria_labels']:
            print(f"  {a['tag']}: {a['label']}")

    # 7. Data attributes that might contain text
    print(f"\n--- INTERESTING DATA ATTRIBUTES ---")
    for d in r['data_attributes']:
        # Filter out common elementor/wp noise
        if any(x in d['attr'] for x in ['data-id', 'data-element_type', 'data-widget_type',
                                          'data-settings', 'data-nonce', 'data-src', 'data-srcset']):
            continue
        if d['value'] and len(d['value']) > 0:
            print(f"  {d['tag']}.{d['attr']} = '{d['value'][:100]}'")

    # 8. Look for text with specific styling
    print(f"\n--- TEXT WITH INLINE STYLES ---")
    for t in r['all_text_with_context']:
        if t['style'] and t['text']:
            print(f"  [{t['tag']} style='{t['style']}'] -> '{t['text'][:100]}'")

    # 9. Look for links in content area
    print(f"\n--- CONTENT LINKS ---")
    for link in r['links']:
        href = link['href']
        if href and 'beast.travel' in href and '/home/' in href:
            print(f"  LINK: {href} | title={link['title']} | aria={link['aria_label']}")

    return r


def extract_caption_details(filename):
    """Extract the exact HTML around each caption to look for formatting differences."""
    print(f"\n{'='*80}")
    print(f"DETAILED CAPTION EXTRACTION: {filename}")
    print(f"{'='*80}")

    with open(filename, 'r', encoding='utf-8') as f:
        html = f.read()

    # Find all figcaption blocks with surrounding context
    pattern = r'<figcaption[^>]*>(.*?)</figcaption>'
    for m in re.finditer(pattern, html, re.DOTALL):
        caption_html = m.group(1).strip()
        # Get 200 chars before and after for context
        start = max(0, m.start() - 300)
        end = min(len(html), m.end() + 100)
        context = html[start:end]

        # Extract the image src from context
        img_match = re.search(r'<img[^>]*src="([^"]*)"[^>]*/>', context)
        img_src = img_match.group(1) if img_match else 'N/A'
        img_file = img_src.split('/')[-1] if img_src != 'N/A' else 'N/A'

        # Extract alt text
        alt_match = re.search(r'alt="([^"]*)"', context)
        alt_text = alt_match.group(1) if alt_match else 'N/A'

        print(f"\n  IMAGE FILE: {img_file}")
        print(f"  ALT TEXT: {alt_text}")
        print(f"  CAPTION RAW HTML: {caption_html}")

        # Check if caption has any HTML tags inside
        inner_tags = re.findall(r'<[^>]+>', caption_html)
        if inner_tags:
            print(f"  INNER HTML TAGS: {inner_tags}")

        # Check for non-standard characters
        non_ascii = [c for c in caption_html if ord(c) > 127]
        if non_ascii:
            print(f"  NON-ASCII CHARS: {[hex(ord(c)) for c in non_ascii]}")


def extract_raw_text_between_cards(filename):
    """Look for any text between trip cards that might be hidden."""
    print(f"\n{'='*80}")
    print(f"TEXT BETWEEN CARDS: {filename}")
    print(f"{'='*80}")

    with open(filename, 'r', encoding='utf-8') as f:
        html = f.read()

    # Find all text content in the main content area
    # Strip out scripts and styles first
    clean = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    clean = re.sub(r'<style[^>]*>.*?</style>', '', clean, flags=re.DOTALL)

    # Find all visible text
    text_blocks = re.findall(r'>([^<]+)<', clean)
    meaningful_text = [t.strip() for t in text_blocks if t.strip() and len(t.strip()) > 1]

    # Filter out common noise
    noise = {'', 'Menu', 'Skip to content', 'Close'}
    meaningful_text = [t for t in meaningful_text if t not in noise and not t.startswith('/*')]

    print("ALL VISIBLE TEXT CONTENT:")
    for t in meaningful_text:
        if len(t) > 2 and not t.startswith('{'):
            print(f"  '{t}'")


def analyze_image_filenames(filename):
    """Extract and analyze all image filenames for encoded data."""
    print(f"\n{'='*80}")
    print(f"IMAGE FILENAME ANALYSIS: {filename}")
    print(f"{'='*80}")

    with open(filename, 'r', encoding='utf-8') as f:
        html = f.read()

    srcs = re.findall(r'src="(https?://[^"]*(?:\.jpg|\.png|\.gif|\.webp|\.svg)[^"]*)"', html, re.IGNORECASE)
    seen = set()
    for src in srcs:
        filename_part = src.split('/')[-1].split('?')[0]
        if filename_part not in seen:
            seen.add(filename_part)
            # Strip dimension suffixes
            clean_name = re.sub(r'-\d+x\d+', '', filename_part.rsplit('.', 1)[0])
            print(f"  {filename_part}  ->  clean: {clean_name}")


# Run analysis on all pages
for page in ['car.html', 'horse.html', 'plane.html', 'boat.html', 'roamy.html', 'home.html']:
    filepath = f'/Users/abdullahabunasrah/Desktop/ownerfi/html_scrape/{page}'
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        parse_page(filepath)
        extract_caption_details(filepath)
        analyze_image_filenames(filepath)

print("\n\n" + "="*80)
print("CROSS-PAGE ANALYSIS")
print("="*80)

# Now do cross-page analysis - collect all captions and look for patterns
all_captions = {}
for page in ['car.html', 'horse.html', 'plane.html', 'boat.html']:
    filepath = f'/Users/abdullahabunasrah/Desktop/ownerfi/html_scrape/{page}'
    if not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
        continue
    with open(filepath) as f:
        html = f.read()
    captions = re.findall(r'<figcaption[^>]*>(.*?)</figcaption>', html, re.DOTALL)
    transport = page.replace('.html', '')
    all_captions[transport] = [c.strip() for c in captions]

print("\n--- ALL CAPTIONS BY TRANSPORT TYPE ---")
for transport, caps in all_captions.items():
    print(f"\n{transport.upper()}:")
    for cap in caps:
        # Extract just the text, noting any HTML
        text = re.sub(r'<[^>]+>', '', cap)
        has_html = bool(re.search(r'<[^>]+>', cap))
        print(f"  '{text}' {'[HAS HTML TAGS]' if has_html else ''}")

print("\n--- CAPTION VERB ANALYSIS ---")
for transport, caps in all_captions.items():
    print(f"\n{transport.upper()}:")
    for cap in caps:
        text = re.sub(r'<[^>]+>', '', cap)
        # Extract the verb/action word
        # Captions seem to follow pattern: "Verb [prep] DESTINATION!"
        words = text.replace('!', '').split()
        destination = [w for w in words if w.isupper() and len(w) > 3]
        action_words = [w for w in words if not w.isupper() or len(w) <= 3]
        print(f"  ACTION: {' '.join(action_words)} | DEST: {' '.join(destination)}")

print("\n--- FIRST LETTERS OF CAPTIONS ---")
for transport, caps in all_captions.items():
    print(f"\n{transport.upper()}:")
    first_letters = ""
    for cap in caps:
        text = re.sub(r'<[^>]+>', '', cap).strip()
        if text:
            first_letters += text[0]
            print(f"  '{text}' -> first letter: '{text[0]}'")
    print(f"  ALL FIRST LETTERS: {first_letters}")

print("\n--- FIRST LETTERS OF ACTION VERBS ---")
for transport, caps in all_captions.items():
    print(f"\n{transport.upper()}:")
    first_letters = ""
    for cap in caps:
        text = re.sub(r'<[^>]+>', '', cap).strip()
        if text:
            # Get first word only
            first_word = text.split()[0] if text.split() else ''
            first_letters += first_word[0] if first_word else ''
            print(f"  '{first_word}'")
    print(f"  FIRST LETTERS OF VERBS: {first_letters}")

print("\n--- DESTINATION NAME ANALYSIS ---")
for transport, caps in all_captions.items():
    print(f"\n{transport.upper()}:")
    for cap in caps:
        text = re.sub(r'<[^>]+>', '', cap).strip()
        # Find the all-caps word (destination)
        dest_match = re.findall(r'[A-Z]{4,}', text)
        for dest in dest_match:
            print(f"  {dest} -> first: {dest[0]}, last: {dest[-1]}, len: {len(dest)}")
