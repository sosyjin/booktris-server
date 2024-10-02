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
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({limit: '100mb', extended: false}));
/*
// FOR PARSING JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
*/
// CORS OFF
app.use(cors());

// PAGES
app.get('/book_db/book_info', function(req, res) {
  res.json(bookDB);
});

app.get('/user_db/user_info', function(req, res) {
  connectionToUserDB.query('SELECT * from user_info', function (error, results, fields) {
    if (error) throw error;
    userDB = results;
  });
  
  res.json(userDB);
});
app.post('/signin', express.json(), function(req, res) {
  // connectionToUserDB.connect();
  var sql = 'INSERT INTO user_db.user_info (id, pwd, email) VALUES(?,?,?)';
  var param = [req.body.insertId, req.body.insertPassword, req.body.insertEmail];

  connectionToUserDB.query(sql, param, (error, rows, fields) => {
    if (error) throw error;
    //connectionToUserDB.end();
  });
});

app.post('/classification', async function(req, res) {
  var images = req.body.insertImage;

  console.log('insertImage: ', images);

  const response = await ollama.generate({
    model: 'llava',
    prompt: "The given image is the cover image of a used book. Answer 'Great' if it's in a new state, 'Normal' if it's damaged enough to have problems reading, and 'Bad' if it's damaged enough to have problems reading.",
    images: [images],
  });

  res.json(response);
});

app.listen(4000, () => {
  console.log("server start!");
});