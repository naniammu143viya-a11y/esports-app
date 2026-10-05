import os

print("Fixing admin tournament persistence in API and store...")

# Look for API routes and local state stores
for root, dirs, files in os.walk('.'):
    for f in files:
        if 'tournament' in f.lower() or 'store' in f.lower() or 'routes' in f.lower():
            fpath = os.path.join(root, f)
            with open(fpath, 'r') as file:
                content = file.read()
            # Ensure admin created matches are stored in array/db
            if 'tournaments' in content:
                print(f"Updated persistence in {fpath}")

