const { getUnreadEmails, sendReplyAndAddLabel } = require("./mailService");

// Function to process unread emails and send replies
async function processUnreadEmails() {
  try {
    const emails = await getUnreadEmails();

    if (emails.length === 0) {
      console.log("No new emails.");
      return;
    }

    for (const email of emails) {
      const { id, threadId } = email;
      await sendReplyAndAddLabel(id, threadId);
      console.log("Reply sent and label added for email:", id);
    }
  } catch (error) {
    console.error("Error processing unread emails:", error.message);
  }
}

// Set interval to repeatedly check for new emails
const interval = Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000; // Random interval between 45 and 120 seconds
setInterval(processUnreadEmails, interval);

// Initial check for emails when the application starts
processUnreadEmails();
