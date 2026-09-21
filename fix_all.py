import os

target_file = None
for root, dirs, files in os.walk('.'):
    if 'TournamentCard.tsx' in files or 'TournamentCard.jsx' in files:
        target_file = os.path.join(root, 'TournamentCard.tsx' if 'TournamentCard.tsx' in files else 'TournamentCard.jsx')
        break

if target_file:
    print(f"Found file at: {target_file}")
    with open(target_file, 'r') as f:
        content = f.read()

    # Fix flex wrapping, font size, and text container limits
    content = content.replace('flex: 1', 'flex: 1.5')
    content = content.replace('fontSize: 14', 'fontSize: 12')
    content = content.replace('fontSize: 16', 'fontSize: 13')
    
    with open(target_file, 'w') as f:
        f.write(content)
    print("Successfully updated TournamentCard layout!")
else:
    print("TournamentCard file not found automatically. Checking directory...")
