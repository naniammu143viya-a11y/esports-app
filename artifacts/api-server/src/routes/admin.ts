import { Router, type IRouter } from "express";
import {
  IncorrectAdminPasswordError,
  InvalidAdminPasswordError,
  updateAdminPassword,
} from "../lib/admin-password";

const router: IRouter = Router();

router.post("/admin/password", async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ message: "Current and new passwords are required." });
    return;
  }

  try {
    await updateAdminPassword(currentPassword, newPassword);
    res.status(200).json({ success: true, message: "Admin password updated successfully." });
  } catch (error) {
    if (error instanceof InvalidAdminPasswordError) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof IncorrectAdminPasswordError) {
      res.status(401).json({ message: error.message });
      return;
    }

    req.log.error({ err: error }, "Unable to update admin password");
    res.status(500).json({ message: "Unable to update admin password." });
  }
});

export default router;