const router = require("express").Router();

router.use("/auth", require("./auth"));
router.use("/students", require("./students"));
router.use("/companies", require("./companies"));
router.use("/jobs", require("./jobs"));
router.use("/admin", require("./admin"));

module.exports = router;
