const mysql = require('mysql');
const express = require('express');
const cors = require('cors');
const { default: ollama } = require('ollama');

// === DATABASE CONNECTIONS ===
const connectionToBookDB = mysql.createConnection({
  host: 'localhost',
  user: 'librarian',
  password: 'test',
  database: 'book_db'
});
connectionToBookDB.connect();

const connectionToUserDB = mysql.createConnection({
  host: 'localhost',
  user: 'user_manager',
  password: '1234',
  database: 'user_db'
});
connectionToUserDB.connect();

// book_post_db 스키마에 대한 관리자를 추가한 연결 설정
const connectionToBookPostDB = mysql.createConnection({
  host: 'localhost',
  user: 'book_post_manager',  // 추가된 사용자
  password: 'abcd',    // 새로 생성된 사용자의 비밀번호
  database: 'book_post_db'
});
connectionToBookPostDB.connect();

// === WEB ===
const app = express();

// FOR PARSING JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// === BOOK POST ROUTES ===
// book_post_db에서 모든 게시글 가져오기
app.get('/book_post_db/posts', function(req, res) {
  connectionToBookPostDB.query('SELECT * FROM post', function (error, results) {
    if (error) throw error;
    res.json(results);
  });
});

// book_post_db에 새로운 게시글 추가하기
app.post('/book_post_db/posts', function(req, res) {
  const {
    user_id,
    location,
    book_condition,
    book_description,
    price,
    transaction_type,
    image_urls,
    main_image_url,
    book_title,
    author,
    translator,
    publisher
  } = req.body;

  const sql = `
    INSERT INTO post (
      user_id, location, book_condition, book_description, price, transaction_type, image_urls, main_image_url, 
      book_title, author, translator, publisher
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    user_id, location, book_condition, book_description, price, transaction_type, JSON.stringify(image_urls), main_image_url, 
    book_title, author, translator, publisher
  ];

  connectionToBookPostDB.query(sql, params, (error, results) => {
    if (error) {
      console.error(error);
      res.status(500).send('Server error');
    } else {
      res.status(201).json({ message: 'Post added successfully', postId: results.insertId });
    }
  });
});

// === EXISTING ROUTES ===
app.get('/book_db/book_info', function(req, res) {
  res.json(bookDB);
});

app.get('/user_db/user_info', function(req, res) {
  connectionToUserDB.query('SELECT * from user_info', function (error, results, fields) {
    if (error) throw error;
    userDB = results;
    res.json(userDB);
  });
});

app.post('/signin', express.json(), function(req, res) {
  var sql = 'INSERT INTO user_db.user_info (id, pwd, email) VALUES(?,?,?)';
  var param = [req.body.insertId, req.body.insertPassword, req.body.insertEmail];

  connectionToUserDB.query(sql, param, (error, rows, fields) => {
    if (error) throw error;
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

// === SERVER LISTENING ===
app.listen(4000, () => {
  console.log("server start!");
});
