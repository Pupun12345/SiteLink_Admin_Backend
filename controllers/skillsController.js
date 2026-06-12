const Skill = require('../models/Skill');

// @desc    Get all skills
// @route   GET /api/skills
// @access  Public
exports.getAllSkills = async (req, res) => {
  try {
    const skills = await Skill.find().sort({ id: 1 });
    res.status(200).json({
      success: true,
      data: skills,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skills',
      error: error.message,
    });
  }
};

// @desc    Get skill by ID
// @route   GET /api/skills/:id
// @access  Public
exports.getSkillById = async (req, res) => {
  try {
    const skill = await Skill.findOne({ id: parseInt(req.params.id) });
    
    if (!skill) {
      return res.status(404).json({
        success: false,
        message: 'Skill not found',
      });
    }

    res.status(200).json({
      success: true,
      data: skill,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch skill',
      error: error.message,
    });
  }
};