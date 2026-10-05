import os

print("Injecting missing Origin and Referer headers into API calls...")

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root:
        continue
    for f in files:
        if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
            filepath = os.path.join(root, f)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                if 'headers' in content or 'fetch' in content or 'axios' in content:
                    updated = content.replace(
                        "headers: {",
                        "headers: {\n      'Origin': 'https://workspace.replit.dev',\n      'Referer': 'https://workspace.replit.dev',\n      'X-Requested-With': 'XMLHttpRequest',"
                    )
                    with open(filepath, 'w', encoding='utf-8') as file:
                        file.write(updated)
                    print(f"Updated headers in {filepath}")
            except Exception as e:
                pass
