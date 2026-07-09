const LegalPolicy = require('../models/LegalPolicy');

exports.getAllPoliciesPublic = async (req, res) => {
  try {
    const policies = await LegalPolicy.find()
      .populate('createdBy', 'name email')
      .sort({ policyType: 1, version: -1 });

    const grouped = {
      PRIVACY_POLICY: policies.filter(p => p.policyType === 'PRIVACY_POLICY'),
      TERMS_AND_CONDITIONS: policies.filter(p => p.policyType === 'TERMS_AND_CONDITIONS'),
      HELP_AND_SUPPORT: policies.filter(p => p.policyType === 'HELP_AND_SUPPORT'),
    };

    res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching policies', error: error.message });
  }
};

// Create a new policy version (Admin only)
exports.createOrUpdatePolicy = async (req, res) => {
  try {
    const { policyType, title, content, changelog, summary, effectiveDate, version } = req.body;
    const userId = req.user?.id;

    if (!policyType || !title || !content) {
      return res.status(400).json({ success: false, message: 'policyType, title, and content are required' });
    }

    const validTypes = ['PRIVACY_POLICY', 'TERMS_AND_CONDITIONS','HELP_AND_SUPPORT'];
    if (!validTypes.includes(policyType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid policy type. Must be PRIVACY_POLICY or TERMS_AND_CONDITIONS or HELP_AND_SUPPORT' });
    }

    // Determine version number — use admin-provided or auto-increment
    let newVersion;
    if (version && !isNaN(parseFloat(version))) {
      newVersion = parseFloat(version);
    } else {
      const latest = await LegalPolicy.findOne({ policyType: policyType.toUpperCase() }).sort({ version: -1 });
      newVersion = latest ? latest.version + 1 : 1;
    }

    // Deactivate all previous versions of this policy type
    await LegalPolicy.updateMany({ policyType: policyType.toUpperCase() }, { isActive: false });

    const newPolicy = new LegalPolicy({
      policyType: policyType.toUpperCase(),
      title,
      content,
      version: newVersion,
      isActive: true,
      effectiveDate: effectiveDate || new Date(),
      createdBy: userId,
      lastUpdatedBy: userId,
      changelog,
      summary,
    });

    await newPolicy.save();

    const populatedPolicy = await LegalPolicy.findById(newPolicy._id).populate('createdBy', 'name email');

    res.status(201).json({ success: true, message: `${policyType} created successfully`, data: populatedPolicy });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating policy', error: error.message });
  }
};

// Get all policies — all versions of both types (Admin)
exports.getAllPolicies = async (req, res) => {
  try {
    const policies = await LegalPolicy.find()
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .sort({ policyType: 1, version: -1 });

    res.status(200).json({ success: true, data: policies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching policies', error: error.message });
  }
};

// Delete a specific policy version (Admin only)
exports.deletePolicyVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await LegalPolicy.findById(id);

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    await LegalPolicy.findByIdAndDelete(id);

    // If deleted policy was active, promote the next latest version
    if (policy.isActive) {
      const next = await LegalPolicy.findOne({ policyType: policy.policyType }).sort({ version: -1 });
      if (next) { next.isActive = true; await next.save(); }
    }

    res.status(200).json({ success: true, message: 'Policy version deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting policy', error: error.message });
  }
};

