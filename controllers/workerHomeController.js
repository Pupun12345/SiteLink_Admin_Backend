const User = require('../models/User');
const Assignment = require('../models/Assignment');

exports.workerData = async (req, res) => {
    try {
        const workerId = req.user._id;

        if (!workerId) {
            return res.status(400).json({
                success: false,
                message: "It is not a worker"
            })
        }

        const worker = await User.findById(workerId).select('name profileImage isVerified createdAt');

        if (!worker) {
            return res.status(404).json({
                success: false,
                message: "Worker not found"
            })
        }

        res.status(200).json({
            success: true,
            data: {
                name: worker.name,
                profileImage: worker.profileImage,
                isVerified: worker.isVerified,
                joinedAt: worker.createdAt,
            }
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching worker home data",
            error: error.message,
        })
    }
}

// @desc    Get worker's current assignment
// @route   GET /api/community/worker/current-assignment
// @access  Private
exports.getCurrentAssignment = async (req, res) => {
    try {
        const workerId = req.user._id;

        const assignment = await Assignment.findOne({
            workerId: workerId,
            status: 'active',
        })
            .populate('vendorId', 'name companyName profileImage')
            .populate('jobId');

        if (!assignment) {
            return res.status(200).json({
                success: true,
                data: null,
                message: 'No active assignment',
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: assignment._id,
                jobTitle: assignment.jobTitle,
                companyName: assignment.companyName,
                location: assignment.location,
                startDate: assignment.startDate,
                status: assignment.status,
                daysWorked: assignment.daysWorked,
                markedArrived: assignment.markedArrived,
                vendorInfo: assignment.vendorId,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching current assignment',
            error: error.message,
        });
    }
};


// @desc    Get worker assignments history
// @route   GET /api/community/worker/assignments
// @access  Private
exports.getWorkerAssignments = async (req, res) => {
    try {
        const workerId = req.user._id;
        const status = req.query.status || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        let filter = { workerId: workerId };

        if (status) {
            filter.status = status;
        }

        const skip = (page - 1) * limit;

        const assignments = await Assignment.find(filter)
            .populate('vendorId', 'name companyName profileImage')
            .populate('jobId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Assignment.countDocuments(filter);

        const formattedAssignments = assignments.map(a => ({
            _id: a._id,
            jobTitle: a.jobTitle,
            companyName: a.companyName,
            location: a.location,
            workType: a.workType,
            startDate: a.startDate,
            status: a.status,
            daysWorked: a.daysWorked,
            markedArrived: a.markedArrived,
            vendorInfo: a.vendorId,
        }));

        res.status(200).json({
            success: true,
            data: formattedAssignments,
            pagination: {
                current: page,
                limit: limit,
                total: total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching assignments',
            error: error.message,
        });
    }
};


// @desc    Mark worker as arrived
// @route   PUT /api/community/assignments/:assignmentId/mark-arrival
// @access  Private
exports.markWorkerArrival = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const userId = req.user._id;

        const assignment = await Assignment.findById(assignmentId);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found",
            });
        }

        // Only assigned worker can mark arrival
        if (assignment.workerId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only the assigned worker can mark arrival",
            });
        }


        if (assignment.markedArrived && assignment.markedArrived.status === true) {
            return res.status(400).json({
                success: false,
                message: "Arrival already marked",
            });
        }

        assignment.markedArrived = {
            arrivedAt: new Date(),
            status: true,
        };

        assignment.status = "in-progress";


        assignment.daysWorked = (assignment.daysWorked || 0) + 1;

        await assignment.save();

        return res.status(200).json({
            success: true,
            message: "Arrival marked successfully",
            data: {
                _id: assignment._id,
                status: assignment.status,
                markedArrived: assignment.markedArrived,
                daysWorked: assignment.daysWorked,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error marking arrival",
            error: error.message,
        });
    }
};



// @desc    Complete assignment
// @route   PUT /api/community/assignments/:assignmentId/complete
// @access  Private
exports.completeAssignment = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { performanceRating, performanceFeedback } = req.body;
        const userId = req.user._id;

        const assignment = await Assignment.findById(assignmentId);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found',
            });
        }

        // Check authorization
        if (
            assignment.vendorId.toString() !== userId.toString() &&
            req.user.userType !== 'admin'
        ) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to complete this assignment',
            });
        }

        assignment.status = 'completed';
        assignment.performanceRating = performanceRating || null;
        assignment.performanceFeedback = performanceFeedback || null;

        await assignment.save();

        res.status(200).json({
            success: true,
            message: 'Assignment completed successfully',
            data: {
                _id: assignment._id,
                status: assignment.status,
                performanceRating: assignment.performanceRating,
                performanceFeedback: assignment.performanceFeedback,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error completing assignment',
            error: error.message,
        });
    }
};

// @desc    Assign worker to job
// @route   POST /api/community/assignments
// @access  Private (Vendor/Admin)
exports.assignWorker = async (req, res) => {
    try {
        const {
            workerId,
            jobId,
            jobTitle,
            companyName,
            location,
            startDate,
            endDate,
            workType,
            dailyRate,
            totalAmount,
            skillsRequired,
            equipmentRequired,
            description,
        } = req.body;

        const vendorId = req.user._id;

        // Check if vendor/admin
        if (req.user.userType !== 'vendor' && req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only vendors and admins can assign workers',
            });
        }

        // Check if worker exists
        const worker = await User.findById(workerId);
        if (!worker) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found',
            });
        }

        const assignment = await Assignment.create({
            workerId,
            vendorId,
            jobId: jobId || null,
            jobTitle,
            companyName,
            description: description || null,
            location,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            workType,
            dailyRate: dailyRate || null,
            totalAmount: totalAmount || null,
            skillsRequired: skillsRequired || [],
            equipmentRequired: equipmentRequired || [],
            status: 'active',
        });

        const populatedAssignment = await Assignment.findById(assignment._id)
            .populate('vendorId', 'name companyName profileImage')
            .populate('jobId');

        res.status(201).json({
            success: true,
            message: 'Worker assigned successfully',
            data: {
                _id: populatedAssignment._id,
                jobTitle: populatedAssignment.jobTitle,
                companyName: populatedAssignment.companyName,
                location: populatedAssignment.location,
                workType: populatedAssignment.workType,
                startDate: populatedAssignment.startDate,
                status: populatedAssignment.status,
                vendorInfo: populatedAssignment.vendorId,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error assigning worker',
            error: error.message,
        });
    }
};


