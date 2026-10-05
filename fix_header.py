import os

print("Adding X-Requested-With header to all API clients...")

for root, dirs, files in os.walk('.'):
    for f in files:
        if f in ['api.ts', 'client.ts', 'axios.ts', 'fetcher.ts', 'index.ts', 'auth.ts']:
            filepath = os.path.join(root, f)
            try:
                with open(filepath, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Append default header to API config
                if 'headers' in content or 'fetch' in content or 'axios' in content:
                    new_content = content.replace(
                        "headers: {",
                        "headers: {\n      'X-Requested-With': 'XMLHttpRequest',"
                    )
                    with open(filepath, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    print(f"Updated headers in: {filepath}")
            except Exception as e:
                pass

