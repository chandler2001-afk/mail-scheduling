const express = require("express");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const jokes = require("daddy-jokes");
const cron = require("node-cron");
const {getAllMails,addEmail}=require("./db");
const axios=require("axios");

// Creating a Transporter
const oauth = async () => {
    try {
        console.log("Starting OAuth process");
        const oauth2Client = new OAuth2Client(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            "https://developers.google.com/oauthplayground/"
        );
        oauth2Client.setCredentials({
            refresh_token: process.env.REFRESH_TOKEN,
        });
        const accessToken = await oauth2Client.getAccessToken();
        console.log("Access token obtained");
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: process.env.FROM_MAIL,
                clientId: process.env.CLIENT_ID,
                clientSecret: process.env.CLIENT_SECRET,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });
        console.log("Transporter created");
        return transporter;
    } catch (error) {
        console.error("Error in oauth function:", error);
        throw error;
    }
};

// Creating mailOptions
const mailBody = async (to, subject) => {
    try {
        console.log("Starting mailBody function");
        const template = handlebars.compile("{{joke}}");
        const joke = jokes();
        console.log("Generated joke:", joke);
        const context = { joke };
        const output = template(context);
        const mailOptions = {
            from: process.env.FROM_MAIL,
            to: to,
            subject: subject,
            html: output,
        };
        return mailOptions;
    } catch (error) {
        console.error("Error in mailBody function:", error);
        throw error;
    }
};

const app = express();
app.use(express.json());

//  scheduleMail function
const scheduleMail = async (to, subject) => {
    cron.schedule("00 22 * * *", async () => {
        console.log("Cron job triggered");
        try {

            const emailTransporter = await oauth();
            if (emailTransporter) {
                const recipients=await getAllMails();
                const subject="Joke of the day!";
                for(const recipient of recipients) {
                    const mailOptions=await mailBody(recipient.email, subject);
                    await emailTransporter.sendMail(mailOptions);
                    console.log("Mail sent to all recipients");
                }
            } else {
                console.error("Email transporter not initialized.");
            }
        } catch (error) {
            console.error("Error sending email:", error);
        }
    });
};


// Function invoking
// (async () => {
//     try {
//         await scheduleMail();
//         console.log("Email scheduler set up successfully");
//     } catch (error) {
//         console.error("Error in the self-invoking function:", error);
//     }
// })();

const getQuestion=async (req,res)=>{
    try {
        const response=await axios.get("https://alfa-leetcode-api.onrender.com");
        // console.log(response.data);
        const link=response.data.data.activeDailyCodingChallengeQuestion.link;
        res.status(200).json({link})
    } catch (error) {
        console.error(error);
        res.status(500).json({message:"Internal Server Error!"});
    }
}


app.post("/email",addEmail);
app.get("/emails", async (req, res) => {
    try {
        const emails = await getAllMails();
        console.log("Fetched emails:", emails); // Add this line for debugging
        res.json(emails); // Changed from res.status(200).json(emails)
    } catch (error) {
        console.error("Error fetching emails:", error);
        res.status(500).json({ message: "Internal Server Error!", error: error.toString() });
    }
});

app.get("/dailyQuestion",getQuestion);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});