const express = require("express");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const asyncRoute = require("../utils/async-route");

const router = express.Router();

router.get("/mine", requireAuth("child"), asyncRoute(async (req, res) => {
  const tasks = await db.all(
    "SELECT * FROM parent_tasks WHERE child_id = ? ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json({ tasks });
}));

// Backwards-compatible endpoint name: a child can report that the task is
// done, but only the parent can approve it and release the reward.
router.post("/:id/complete", requireAuth("child"), asyncRoute(async (req, res) => {
  const result = await db.transaction(async (tx) => {
    const task = await tx.one(
      "SELECT * FROM parent_tasks WHERE id = ? AND child_id = ?",
      [req.params.id, req.user.id]
    );
    if (!task) { const err = new Error("Task not found"); err.status = 404; throw err; }
    if (task.status === "completed") {
      return { ok: true, status: "completed", alreadyApproved: true };
    }
    if (task.status === "submitted") {
      return { ok: true, status: "submitted", alreadySubmitted: true };
    }

    await tx.run(
      "UPDATE parent_tasks SET status = ?, completed_at = NULL WHERE id = ? AND child_id = ?",
      ["submitted", task.id, req.user.id]
    );

    return {
      ok: true,
      status: "submitted",
      rewardPending: true,
      message: "Task sent to your parent for approval.",
    };
  });

  res.json(result);
}));

module.exports = router;
