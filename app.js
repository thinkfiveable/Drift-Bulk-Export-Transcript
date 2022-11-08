// Main app.js will loop through all the pages of the list conversations endpoint with a certain time range to obtain all the conversation ID's. 
//Then loop a job that retrieves each individual conversation, related chat agent, attributes, transcript.
//You can grab the conversation object as a JSON or download the transcript as a string.


require("dotenv").config();
const DRIFT_AUTH_TOKEN = process.env.DRIFT_AUTH_TOKEN; // oAuth token generated when creating an app within dev.drift.com
const convoReporter = require("./Drift/listConvoIds"); // Hit report endpoint to collect conversationId
const getConvo = require("./Drift/getConversation"); // Hit conversation endpoint to get more detailed information about a particular conversation.
const getScript = require("./Drift/getTranscript"); // The response object will be a formatted string of the entire transcript
const getChatAgents = require("./Drift/getChatAgents.js"); //To list users in your org
const participants = require("./Drift/getParticipants.js"); // Retrieve participants
const sqlite3 = require('sqlite3').verbose();
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: 'export.sqlite'
  }
});

(async () => {
  let convoList = await convoReporter.convoReport(); //return list of conversation Ids

  // Handle error due to no new conversation captured within a specific timeline
  if (convoList == "no new conversations") {
    console.log("No new conversations to add.");
    return;
  } else if (convoList == "Error retrieving conversations.") {
    console.log("Error retrieving conversations.");
    return;
  }

  const chatAgents = await getChatAgents(); //retrieve a hash of ALL Chat Agents in this org

  let convosArray = [];

  // Loop through the conversation list to store conversation objects/transcripts
  for (const convoId of convoList) {
    const result = await knex.select('convo_id')
      .from('conversations').where({ convo_id: convoId.conversationId });

    if (result?.length > 0) {
      console.log(`Skipping ${convoId.conversationId} since it's in the db already.`)
      continue;
    } else {
      console.log('Retrieving and inserting...');
    }

    const convoObject = await getConvo.getConversation(convoId.conversationId);
    const transcriptObject = await getScript.getTranscript(convoId.conversationId);

    if (convoObject !== "Error") {
      const conversationTranscript = transcriptObject // Store transcript object
      const tags = convoObject.data.conversationTags?.map(i => i.name).join(',');

      //Fields that will be added to the CSV file
      const convo = {
        convo_id: convoId.conversationId.toString(), // conversation ID
        link_to_full_conversation:"https://app.drift.com/conversations/" + convoId.conversationId, // conversation link in app.drift.com
        updatedat_date:new Date(convoObject.data.updatedAt).toISOString().slice(0, -5) + "Z", // Stores updatedat_date
        createdat_date:new Date(convoObject.data.createdAt).toISOString().slice(0, -5) + "Z", // Stores createdat_date
        status: convoObject.data.status, // Conversation's Status
        total_messages: convoId.metrics.slice(4, 7).reduce((a, b) => a + b), // Total messages in conversation
        num_agent_messages: convoId.metrics[4], // Stores num_agent_messages
        num_bot_messages: convoId.metrics[5], // Stores num_bot_messages
        num_end_user_messages: convoId.metrics[6], // Stores num_end_user_messages
        transcriptObject: conversationTranscript, // Stores transcriptObject
        tags: tags ? tags : ''
      };

      // Combines conversations data + tags 
      await knex('conversations').insert({
        convo_id: convo.convo_id,
        link_to_full_conversation: convo.link_to_full_conversation,
        updatedat_date: convo.updatedat_date,
        createdat_date: convo.createdat_date,
        status: convo.status,
        total_messages: convo.total_messages,
        num_agent_messages: convo.num_agent_messages,
        num_bot_messages: convo.num_bot_messages,
        num_end_user_messages: convo.num_end_user_messages,
        transcription: transcriptObject,
        tags: convo.tags
      });

      console.log("convo id " + convo.convo_id + " created.");
      convosArray.push(convo);
    }

    // await new Promise(resolve => setTimeout(resolve, 1000 / 9));
  }

  console.log("Data Export is complete.");
})();
