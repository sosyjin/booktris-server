const mysql      = require('mysql');
const express    = require('express');
const cors = require('cors');

// === DATABASE ===
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'librarian',
  password : 'test',
  database : 'book_db'
}); 
connection.connect();
var bookDB = null;
connection.query('SELECT * from book_info', function (error, results, fields) {
  if (error) throw error;
  bookDB = results;
});
connection.end();

// === WEB ===
const app = express();

// FOR PARSING JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// CORS OFF
app.use(cors());

// PAGES
app.get('/', function(req, res) {
  res.send("Hello World!");
});

app.get('/book_db/book_info', function(req, res) {
  res.json(bookDB);
});

app.get('/login', function(req, res) {
  res.send("You are in login page now.");
})
app.get('/login/signin', function(req, res) {
  res.send("Sign in => ");
})

app.listen(4000, () => {
  console.log("server start!");
})