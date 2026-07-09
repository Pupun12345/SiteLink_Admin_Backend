const express = require("express");
const router = express.Router();

const {
    fetchAllAmenities,
    getGroupedAmenities,
    getAllCategories,
    addAmenities,
    updateAmenity,
    deleteAmenity,
} = require("../controllers/jobsController");

const { protect } = require("../middleware/auth");

// Public
router.get("/", fetchAllAmenities);
router.get("/grouped", getGroupedAmenities);

// Admin
router.get("/categories", protect, getAllCategories);
router.post("/", protect, addAmenities);
router.put("/:id", protect, updateAmenity);
router.delete("/:id", protect, deleteAmenity);

module.exports = router;