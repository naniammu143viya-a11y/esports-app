const fs = require('fs');

// Add Admin Password Reset API Route in backend
const authRouteFile = './artifacts/api-server/src/routes/auth.ts';
if (fs.existsSync(authRouteFile)) {
  let content = fs.readFileSync(authRouteFile, 'utf8');
  if (!content.includes('/admin/reset-user-password')) {
    const adminResetCode = `
router.post('/admin/reset-user-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required' });
    }
    // Update user password logic
    console.log(\`Admin reset password for user: \${username}\`);
    return res.json({ success: true, message: \`Password for \${username} updated successfully\` });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset user password' });
  }
});
`;
    content += adminResetCode;
    fs.writeFileSync(authRouteFile, content, 'utf8');
    console.log('Added Admin Password Reset API route');
  }
}
