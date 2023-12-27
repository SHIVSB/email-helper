const { google } = require("googleapis");
const dotenv = require("dotenv");

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// Configure the Gmail API client
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// Function to get the list of all the unread emails in the inbox
async function getUnreadEmails() {
  try {
    const res = await gmail.users.messages.list({
      // could have fetched the threadsd
      userId: "me",
      q: "is:unread -from:me -{label:Replied} -in:chats", // unread -sent -replied -chats
    });

    const emails = res.data.messages || [];
    const unreadEmails = [];

    for (const email of emails) {
      const message = await gmail.users.messages.get({
        userId: "me",
        id: email.id,
      });

      const threadId = message.data.threadId;
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
      });

      const threadEmails = thread.data.messages || [];
      const isReply = threadEmails.length > 1;

      if (!isReply) {
        unreadEmails.push({
          id: email.id,
          threadId: threadId,
        });
      }
    }

    return unreadEmails;
  } catch (error) {
    throw new Error("Error fetching unread emails: " + error.message);
  }
}

// Function to send a reply and add label to an email thread
async function sendReplyAndAddLabel(id, threadId) {
  try {
    const res = await gmail.users.messages.get({
      userId: "me",
      id: id,
      format: "full",
    });
    const fullEmail = res.data;

    // Extract recipient's email address
    const headers = fullEmail.payload.headers;
    const recipientEmail = headers.find(
      (header) => header.name.toLowerCase() === "from"
    ).value;

    const subject = headers.find(
      (header) => header.name.toLowerCase() === "subject"
    ).value;

    const originalMessageId = headers.find(
      (header) => header.name.toLowerCase() === "message-id"
    ).value;

    // Fetch the original thread using the Gmail API
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });

    const thread = response.data;
    const originalMessage = thread.messages[0];

    //Construct the reply message
    const replyMessage = {
      threadId: threadId,
      raw: createRawMessage(
        originalMessage.id,
        recipientEmail,
        `Re: ${subject}`,
        originalMessageId,
        "Thank you for your email. I am currently out of station and I will reach out to you as soon as possible."
      ),
    };

    // Send the reply message using the Gmail API
    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: replyMessage,
    });

    // Add label to the email thread
    const labelsResponse = await gmail.users.labels.list({ userId: "me" });
    const labels = labelsResponse.data.labels;
    const labelName = "Replied"; // Label Name

    let labelId = null;

    // Check if the label already exists
    for (const label of labels) {
      if (label.name === labelName) {
        labelId = label.id;
        break;
      }
    }

    // If the label doesn't exist, create it
    if (!labelId) {
      const labelResponse = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: labelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });

      labelId = labelResponse.data.id;
    }

    // Apply the label to the email thread
    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });

    return result;
  } catch (error) {
    throw new Error("Error sending reply and adding label: " + error.message);
  }
}

// Function to create the raw message string for the reply
function createRawMessage(inReplyTo, recipientEmail, subject, messageId, body) {
  const references = inReplyTo ? `${inReplyTo} ${messageId}` : messageId;
  const headers = [
    `To: ${recipientEmail}`,
    `From: Shiv shivtechnica02@gmail.com`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${references}, ${inReplyTo}`,
  ];

  const message = headers.concat("", body).join("\n");
  return Buffer.from(message).toString("base64");
}

module.exports = {
  sendReplyAndAddLabel,
  getUnreadEmails,
};
