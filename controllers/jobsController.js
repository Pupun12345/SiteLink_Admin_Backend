const Job = require('../models/job');
const User = require('../models/User');
const Application = require('../models/Application');
const Subscription = require('../models/Subscription');
const mongoose = require("mongoose");
const Amenity = require('../models/amenities');
const notifyMatchingWorkers = require('../utils/notifyMatchingWorkers');
const notifyUser = require('../utils/notifyUser');

// Admin ne application approve / reject ki — worker ko uski bhasha me
// saaf message. Admin ka likha reason (notes) ho to wo bhi; panel ka
// default "Status updated to …" text nahi bhejte.
function applicationStatusMessage(jobTitle, status, notes, lang) {
  const job = (jobTitle || '').trim() || (lang === 'hindi' ? 'जॉब' : 'the job');
  const note = typeof notes === 'string' && notes.trim()
    && !/^Status updated to /i.test(notes.trim())
    && !/^Congratulations! Your application has been approved/i.test(notes.trim())
    ? notes.trim().slice(0, 200)
    : '';
  const hi = lang === 'hindi';
  if (['approved', 'hired', 'confirmed', 'shortlisted'].includes(status)) {
    return hi
      ? { title: '🎉 बधाई हो! आपका आवेदन मंज़ूर हुआ', body: note || `"${job}" के लिए आपका आवेदन मंज़ूर हो गया है। हमारी टीम जल्द आपसे संपर्क करेगी।` }
      : { title: '🎉 Congratulations! Application approved', body: note || `Your application for "${job}" has been approved. Our team will contact you shortly.` };
  }
  if (status === 'rejected') {
    const base = hi
      ? `"${job}" के लिए इस बार आपका आवेदन चुना नहीं गया।`
      : `Your application for "${job}" was not selected this time.`;
    const tail = hi ? ' दूसरी जॉब्स के लिए आवेदन करते रहें।' : ' Keep applying for other jobs.';
    return {
      title: hi ? 'आवेदन अपडेट' : 'Application update',
      body: note ? `${base} ${hi ? 'कारण' : 'Reason'}: ${note}` : base + tail,
    };
  }
  return null;
}

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { location, salaryType, search } = req.query;

    // Find vendor IDs whose subscription is expired/cancelled/inactive or past endDate
    const now = new Date();
    const expiredSubs = await Subscription.find({
      $or: [
        { status: { $in: ['expired', 'cancelled', 'inactive'] } },
        { endDate: { $lt: now } },
      ],
    }).select('user');
    const expiredVendorIds = expiredSubs.map(s => s.user);

    let filter = {
      approvalStatus: 'approved',
      // Exclude jobs posted by vendors with expired subscriptions
      $nor: [{ postedBy: { $in: expiredVendorIds } }],
    };

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (salaryType) {
      filter.salaryType = salaryType;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const jobs = await Job.find(filter)
      .populate("postedBy", "name companyName")
      .populate("amenities", "id name category icon")
      .sort({ createdAt: -1 });

    // Update applicationsCount for each job from Application collection
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const count = await Application.countDocuments({ job: job._id });
        const jobObj = job.toObject();
        jobObj.applicationsCount = count;
        return jobObj;
      })
    );

    res.status(200).json({
      success: true,
      count: jobsWithCounts.length,
      data: jobsWithCounts,
    });
  } catch (error) {
    console.error("GET JOB ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// @desc    Get single job by ID with applicants
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Job ID",
      });
    }

    // Get job details
    const job = await Job.findById(req.params.id)
      .populate("postedBy", "name companyName")
      .populate("amenities", "id name category icon");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get applications for this job
    const applications = await Application.find({
      job: req.params.id,
    })
      .populate(
        "applicant",
        "name profileImage userType verificationStatus city workState salaryType salary experience skills phone email primarySkill"
      )
      .sort({ createdAt: -1 })
      .limit(10);

    // Transform applications data
    const transformedApplicants = applications
      .filter((application) => application.applicant) // avoid null applicants
      .map((application) => {
        const applicant = application.applicant;
        const timeApplied = application.createdAt;

        return {
          id: application._id,
          applicantId: applicant._id,
          name: applicant.name,

          role:
            applicant.primarySkill ||
              (
                applicant.skills &&
                applicant.skills.length > 0
              )
              ? (
                applicant.primarySkill ||
                applicant.skills[0]?.skillName ||
                "Worker"
              )
              : "Worker",

          status: application.status,
          applied: timeApplied,

          avatar:
            applicant.profileImage ||
            `https://ui-avatars.io/api/?name=${encodeURIComponent(
              applicant.name
            )}&background=random`,

          experience: applicant.experience || "Not specified",

          location: applicant.city || "Not specified",

          skills: applicant.skills
            ? applicant.skills.map((skill) =>
              typeof skill === "object"
                ? skill.skillName
                : skill
            )
            : [],

          phone: applicant.phone,
          email: applicant.email,

          dailyRate:
            applicant.dailyRate ||
            applicant.salary ||
            null,

          coverLetter: application.coverLetter,

          applicationExperience:
            application.experience,
        };
      });

    // Count all applications
    const actualApplicationsCount =
      await Application.countDocuments({
        job: req.params.id,
      });

    // Preserve existing response structure
    const jobData = {
      ...job.toJSON(),
      applicants: transformedApplicants,
      applicationsCount: actualApplicationsCount,
    };

    return res.status(200).json({
      success: true,
      data: jobData,
    });
  } catch (error) {
    console.error("GET JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch job",
    });
  }
};


// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = async (req, res) => {
  try {
    const { title, company, location, latitude, longitude, quantity, salary, salaryType, isUrgent, duration, description, experience, amenities, companyLogoUrl, postedFor, contactName, contactWhatsapp, startDate } = req.body;

    const user = await User.findById(req.user.id);
    // Allow admin users (from AdminUser collection) to create jobs directly
    const isAdmin = req.user.userType === 'admin' || !!req.user.permissions;
    if (!isAdmin) {
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Account verification required for posting jobs. Please wait for your account to be verified before creating a job.'
        });
      }

      if (user.userType === 'worker' || user.userType === 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only Vendor or Admin can create jobs'
        });
      }
    }

    if (!title || !company || !location || !description || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (salaryType && !['daily', 'weekly', 'monthly'].includes(salaryType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid salary type.Salary type must be one of: daily, weekly, monthly',
      });
    }

    const parsedSalary = Number(salary);
    if (
      isNaN(parsedSalary) ||
      parsedSalary < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid salary'
      });
    }

    if (experience && isNaN(experience)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Experience value.Experience must be a number'
      });
    }

    const exp = Number(experience);
    if (
      isNaN(exp) ||
      exp < 0 ||
      exp > 60
    ) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 60 years'
      });
    }

    // Validate Amenities
    let amenityObjectIds = [];

    if (amenities && !Array.isArray(amenities)) {
      return res.status(400).json({
        success: false,
        message: "Amenities must be an array.",
      });
    }

    if (amenities && amenities.length > 0) {
      const Amenity = require('../models/amenities');
      const amenityDocs = await Amenity.find({
        _id: { $in: amenities },
      }).select("_id");

      if (amenityDocs.length !== amenities.length) {
        return res.status(400).json({
          success: false,
          message: "One or more selected amenities are invalid.",
        });
      }

      amenityObjectIds = amenityDocs.map((amenity) => amenity._id);
    }

    const workersNeeded = Number(quantity);
    if (
      isNaN(workersNeeded) ||
      workersNeeded <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    // ── Job kis vendor ke liye (admin) — worker ko wahi contact dikhe ──
    // Vendor chuna ho to uski company / naam / WhatsApp default; admin ne
    // form me kuch badla ho to wo upar. WhatsApp 10-digit Indian number.
    let vendor = null;
    if (postedFor && mongoose.Types.ObjectId.isValid(postedFor)) {
      vendor = await User.findOne({ _id: postedFor, userType: 'vendor' })
        .select('name companyName whatsappNumber phone companyLogo');
      if (!vendor) {
        return res.status(400).json({ success: false, message: 'Selected vendor not found' });
      }
    }
    const waDigits = String(contactWhatsapp || '').replace(/\D/g, '').slice(-10);
    const whatsapp = waDigits || (vendor ? String(vendor.whatsappNumber || vendor.phone || '').replace(/\D/g, '').slice(-10) : '');
    if (whatsapp && !/^[6-9]\d{9}$/.test(whatsapp)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit WhatsApp number' });
    }
    // Naksha / lat-lng — 0,0 ya galat value save nahi (app "Get Directions"
    // samundar me le jaata tha).
    const lat = Number(latitude);
    const lng = Number(longitude);
    const hasPin = Number.isFinite(lat) && Number.isFinite(lng)
      && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    const job = await Job.create({
      title: title.trim(),
      company: (company && company.trim()) || vendor?.companyName || 'Sitelink',
      location: location.trim(),
      latitude: hasPin ? String(lat) : undefined,
      longitude: hasPin ? String(lng) : undefined,
      postedFor: vendor ? vendor._id : null,
      contactName: (contactName && String(contactName).trim()) || vendor?.name || null,
      contactWhatsapp: whatsapp || null,
      startDate: startDate && !Number.isNaN(new Date(startDate).getTime()) ? new Date(startDate) : null,
      quantity: workersNeeded.toString(),
      salary: parsedSalary,
      salaryType: salaryType,
      isUrgent: isUrgent || false,
      duration: duration ? duration.trim() : '',
      description: description.trim(),
      experience: exp.toString(),
      amenities: amenityObjectIds,
      companyLogo: companyLogoUrl || vendor?.companyLogo || undefined,
      postedBy: req.user.id,
      isActive: true,
      // Jobs are auto-approved now (no admin review workflow) — admin-created
      // jobs go live immediately, matching the app backend's behavior.
      approvalStatus: 'approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: job,
    });

    // Admin ki job turant live hoti hai — matching workers (skill + jagah)
    // ko nayi job ki khabar. Response iska intezaar nahi karta.
    notifyMatchingWorkers(job);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create job',
      error: error.message,
    });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
exports.updateJob = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.amenities) {
      const validAmenities = await Amenity.countDocuments({
        _id: { $in: updateData.amenities },
      });

      if (validAmenities !== updateData.amenities.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid amenities selected.",
        });
      }
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update job',
      error: error.message,
    });
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: error.message,
    });
  }
};

// Helper function to check and update job status
const checkAndUpdateJobStatus = async (jobId) => {
  try {
    const job = await Job.findById(jobId);
    if (!job) return;

    // Count accepted applications
    const acceptedCount = await Application.countDocuments({
      job: jobId,
      status: 'accepted'
    });

    const workersNeeded = parseInt(job.quantity) || 0;

    // If accepted applications meet or exceed quantity, mark as Filled
    if (acceptedCount >= workersNeeded && job.status !== 'Filled') {
      job.status = 'Filled';
      await job.save();
      console.log(`Job ${jobId} marked as Filled: ${acceptedCount}/${workersNeeded} workers`);
    }
  } catch (error) {
    console.error('Error checking job status:', error);
  }
};

// @desc    Update application status
// @route   PUT /api/jobs/:jobId/applications/:applicationId
// @access  Private
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Job ka maalik, ya admin (admin panel se kisi bhi vendor ki job ke
    // applicants approve / reject ho sakein).
    const isAdmin = req.user.userType === 'admin' || req.user.role === 'admin';
    if (job.postedBy.toString() !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application',
      });
    }

    const before = await Application.findOne({ _id: applicationId, job: jobId }).select('status');

    const application = await Application.findOneAndUpdate(
      { _id: applicationId, job: jobId },
      {
        status,
        notes,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
      { new: true }
    ).populate('applicant', 'name profileImage userType language');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    // Check and update job status after application status change
    await checkAndUpdateJobStatus(jobId);

    // Worker ko batao — sirf jab status sach me badla ho (dobara click par
    // dobara notification nahi). Fire-and-forget: response nahi rukta.
    if (before && before.status !== status && application.applicant) {
      const msg = applicationStatusMessage(job.title, status, notes, application.applicant.language);
      if (msg) {
        notifyUser(application.applicant._id, {
          type: 'application_status',
          title: msg.title,
          body: msg.body,
          data: { jobId: String(job._id), applicationId: String(application._id), status: String(status) },
        }).catch((e) => console.error('[updateApplicationStatus] notifyUser failed:', e.message));
      }
    }

    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: error.message,
    });
  }
};

// @desc    Get applications for a job
// @route   GET /api/jobs/:id/applications
// @access  Private
exports.getJobApplications = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.postedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view applications for this job',
      });
    }

    let filter = { job: jobId };
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const applications = await Application.find(filter)
      .populate('applicant', 'name profileImage userType verificationStatus city dailyRate experience skills phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalApplications = await Application.countDocuments(filter);

    const transformedApplications = applications.map((application) => {
      const applicant = application.applicant;
      return {
        id: application._id,
        applicantId: applicant._id,
        name: applicant.name,
        role: applicant.primarySkill || (applicant.skills && applicant.skills.length > 0 ? applicant.skills[0].skillName : 'Worker'),
        status: application.status,
        applied: application.createdAt,
        avatar: applicant.profileImage || `https://ui-avatars.io/api/?name=${encodeURIComponent(applicant.name)}&background=random`,
        experience: applicant.experience || 'Not specified',
        location: applicant.city || 'Not specified',
        skills: applicant.skills ? applicant.skills.map(s => s.skillName) : [],
        phone: applicant.phone,
        email: applicant.email,
        dailyRate: applicant.dailyRate || applicant.salary,
        coverLetter: application.coverLetter,
        applicationExperience: application.experience
      };
    });

    res.status(200).json({
      success: true,
      data: {
        applications: transformedApplications,
        pagination: {
          total: totalApplications,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalApplications / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message,
    });
  }
};

// @desc    Like/Unlike a job
// @route   PUT /api/jobs/:jobId/like
// @access  Private
exports.likeUnlikeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const likeIndex = job.likes.findIndex(like => like.userId.toString() === userId.toString());

    if (likeIndex > -1) {
      // Unlike
      job.likes.splice(likeIndex, 1);
      job.likesCount = Math.max(0, job.likesCount - 1);
    } else {
      // Like
      job.likes.push({
        userId: userId,
        likedAt: new Date(),
      });
      job.likesCount += 1;
    }

    await job.save();

    const updatedJob = await Job.findById(jobId)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name');

    res.status(200).json({
      success: true,
      message: likeIndex > -1 ? 'Job unliked' : 'Job liked',
      data: {
        _id: updatedJob._id,
        likesCount: updatedJob.likesCount,
        likes: updatedJob.likes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error liking/unliking job',
      error: error.message,
    });
  }
};

// @desc    Add comment to a job
// @route   POST /api/jobs/:id/comments
// @access  Private
exports.addJobComment = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty',
      });
    }

    if (comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 500 characters',
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const user = await User.findById(userId);
    const newComment = {
      userId,
      userName: user.name,
      userImage: user.profileImage,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    job.comments.push(newComment);
    job.commentsCount = job.comments.length;
    await job.save();

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message,
    });
  }
};

// @desc    Get comments for a job
// @route   GET /api/jobs/:id/comments
// @access  Public
exports.getJobComments = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const comments = job.comments.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: job.commentsCount,
        pages: Math.ceil(job.commentsCount / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message,
    });
  }
};

// @desc    Delete comment from job
// @route   DELETE /api/jobs/:jobId/comments/:commentId
// @access  Private
exports.deleteJobComment = async (req, res) => {
  try {
    const { jobId, commentId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const commentIndex = job.comments.findIndex(c => c._id.toString() === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const user = await User.findById(userId);
    if (job.comments[commentIndex].userId.toString() !== userId.toString() && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    job.comments.splice(commentIndex, 1);
    job.commentsCount = job.comments.length;
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message,
    });
  }
};


exports.fetchAllAmenities = async (req, res) => {
  try {
    const data = await Amenity.find().sort({ category: 1, id: 1 });
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenities",
      error: error.message,
    });
  }
};

exports.getGroupedAmenities = async (req, res) => {
  try {
    const data = await Amenity
      .find()
      .sort({ category: 1, id: 1 })
      .select("_id id name category icon");

    const grouped = {};

    data.forEach((amenity) => {
      if (!grouped[amenity.category]) {
        grouped[amenity.category] = {
          category: amenity.category,
          icon: amenity.icon,
          amenities: [],
        };
      }

      grouped[amenity.category].amenities.push({
        _id: amenity._id,
        id: amenity.id,
        name: amenity.name,
      });
    });

    return res.status(200).json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenities",
      error: error.message,
    });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Amenity.distinct("category");
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.addAmenities = async (req, res) => {
  try {
    const { name, category } = req.body;

    const userId = req.user.id;

    const user = await User.findById(userId).select("userType");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      user.userType === "worker" ||
      user.userType === "customer"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to add amenities",
      });
    }

    const CATEGORY_ICONS = {
      "Financial Benefits": "💰",
      "Accommodation & Food": "🏠",
      "Travel": "🚌",
      "Safety & Medical": "🛡️",
      "Leave": "📅",
      "Work & Career": "📈",
      "Employee Rewards": "🏆",
    };

    if (!CATEGORY_ICONS[category]) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const existingAmenity = await Amenity.findOne({ name });

    if (existingAmenity) {
      return res.status(400).json({
        success: false,
        message: "Amenity already exists",
      });
    }

    const lastAmenity = await Amenity.findOne().sort({ id: -1 });

    const nextId = lastAmenity ? lastAmenity.id + 1 : 1;

    const amenity = await Amenity.create({
      id: nextId,
      name,
      category,
      icon: CATEGORY_ICONS[category],
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Amenity added successfully",
      data: amenity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;

    const user = await User.findById(req.user.id).select("userType");

    if (!user || user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update amenities",
      });
    }

    const CATEGORY_ICONS = {
      "Financial Benefits": "💰",
      "Accommodation & Food": "🏠",
      "Travel": "🚌",
      "Safety & Medical": "🛡️",
      "Leave": "📅",
      "Work & Career": "📈",
      "Employee Rewards": "🏆",
    };

    if (category && !CATEGORY_ICONS[category]) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    // Prevent duplicate names
    if (name) {
      const existingAmenity = await Amenity.findOne({
        name,
        _id: { $ne: id },
      });

      if (existingAmenity) {
        return res.status(400).json({
          success: false,
          message: "Amenity with this name already exists",
        });
      }
    }

    const amenity = await Amenity.findByIdAndUpdate(
      id,
      {
        ...(name && { name }),
        ...(category && {
          category,
          icon: CATEGORY_ICONS[category],
        }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Amenity updated successfully",
      data: amenity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.deleteAmenity = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user.id).select("userType");

    if (!user || user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete amenities",
      });
    }

    // Check if any job is using this amenity
    const jobUsingAmenity = await Job.findOne({
      amenities: id,
    });

    if (jobUsingAmenity) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete amenity because it is being used in one or more jobs.",
      });
    }

    const amenity = await Amenity.findByIdAndDelete(id);

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Amenity deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
