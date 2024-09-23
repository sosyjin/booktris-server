const mysql      = require('mysql');
const express    = require('express');
const cors = require('cors');
const { default: ollama } = require('ollama');

// === DATABASE ===
const connectionToBookDB = mysql.createConnection({
  host     : 'localhost',
  user     : 'librarian',
  password : '1234',
  database : 'book_db'
}); 
connectionToBookDB.connect();
var bookDB = null;
connectionToBookDB.query('SELECT * from book_info', function (error, results, fields) {
  if (error) throw error;
  bookDB = results;
});
connectionToBookDB.end();

const connectionToUserDB = mysql.createConnection({
  host     : 'localhost',
  user     : 'user_manager',
  password : '1234',
  database : 'user_db'
}); 
connectionToUserDB.connect();
var userDB = null;
connectionToUserDB.query('SELECT * from user_info', function (error, results, fields) {
  if (error) throw error;
  userDB = results;
});

// === WEB ===
const app = express();

// FOR PARSING JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// CORS OFF
app.use(cors());

// PAGES
app.get('/book_db/book_info', function(req, res) {
  res.json(bookDB);
});

app.get('/user_db/user_info', function(req, res) {
  res.json(userDB);
});
app.post('/signin', express.json(), function(req, res) {
  // connectionToUserDB.connect();
  console.log(req.body);

  var sql = 'INSERT INTO user_db.user_info (id, pwd, email) VALUES(?,?,?)';
  var param = [req.body.insertId, req.body.insertPassword, req.body.insertEmail];

  connectionToUserDB.query(sql, param, (error, rows, fields) => {
    if (error) throw error;
    console.log('User info is: ', rows);
    //connectionToUserDB.end();
  });
});

app.get('/classification', async function(req, res) {
  const response = await ollama.chat({
    model: 'llava',
    messages: [{ role: 'user', content: 'Why is the sky blue?' }],
    role: 'assistant',
  });

  res.json(response);
});

app.listen(4000, () => {
  console.log("server start!");
})