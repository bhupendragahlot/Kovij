import express from "express"
import nodemailer from "nodemailer"
import cors from "cors"
import dotenv from "dotenv"
import bodyParser from "body-parser"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(bodyParser.json())

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Email sending endpoint
app.post("/api/send-email", async (req, res) => {
  const { name, email, phone, message } = req.body

  try {
    // Email to gym owner
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // You can change this to your gym's email
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    }

    // Auto-reply to customer
    const autoReplyOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Thank you for contacting Kovij Fitness Zone",
      html: `
        <h2>Thank you for contacting Kovij Fitness Zone!</h2>
        <p>Dear ${name},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p>Here's a summary of your inquiry:</p>
        <p>${message}</p>
        <br>
        <p>Best regards,</p>
        <p>The Kovij Fitness Zone Team</p>
      `,
    }

    // Send emails
    await transporter.sendMail(mailOptions)
    await transporter.sendMail(autoReplyOptions)

    res.status(200).json({ success: true, message: "Email sent successfully!" })
  } catch (error) {
    console.error("Error sending email:", error)
    res.status(500).json({ success: false, message: "Failed to send email", error: error.message })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

