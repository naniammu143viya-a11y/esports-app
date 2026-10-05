import os

print("Updating Admin Username to 'admin'...")

config_code = """
export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "Admin@9988"
};
"""

for root, dirs, files in os.walk('.'):
    for f in files:
        if f in ['admin.ts', 'auth.ts', 'adminRoutes.ts', 'seed.ts', 'schema.ts']:
            filepath = os.path.join(root, f)
            with open(filepath, 'a') as file:
                file.write("\n// Updated Admin Username to admin\n" + config_code)
            print(f"Updated: {filepath}")

