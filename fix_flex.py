file_path = 'src/components/TournamentCard.tsx'
try:
    with open(file_path, 'r') as f:
        content = f.read()

    # Give more flex space to statutory containers and remove tight flex constraints
    content = content.replace('flex: 1', 'flex: 1.2')
    content = content.replace('fontSize: 14', 'fontSize: 13')
    
    with open(file_path, 'w') as f:
        f.write(content)
    print("Flex fixed successfully")
except Exception as e:
    print("Error:", e)
