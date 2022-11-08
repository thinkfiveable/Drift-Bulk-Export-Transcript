const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./export.sqlite', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
db.run('CREATE TABLE conversations(convo_id INT, link_to_full_conversation TEXT, updatedat_date DATETIME, createdat_date DATETIME, status STRING, total_messages INT, num_agent_messages INT, num_bot_messages INT, num_end_user_messages INT, transcription TEXT, tags TEXT, UNIQUE(convo_id))');
db.close();