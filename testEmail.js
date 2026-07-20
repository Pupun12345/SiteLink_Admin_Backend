require("dotenv").config();

const nodemailer = require("nodemailer");

async function sendTestMail() {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        await transporter.verify();
        console.log("SMTP connection successful");

        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: "kanhapatra801@gmail.com",
            subject: "Nodemailer Test",
            text: "Hello from Node.js",
        });

        console.log("Email sent:", info);
    } catch (error) {
        console.error("ERROR:");
        console.error(error);
    }
}

sendTestMail();