const mysql = require('mysql');
const http = require("http");
const express = require('express');
const app = express();
const cors = require('cors');
const io = require('socket.io');
const { default: ollama } = require('ollama');

// === DATABASE CONNECTIONS ===
const connectionToBookDB = mysql.createConnection({
  host: 'localhost',
  user: 'librarian',
  password: '1234',
  database: 'book_db'
});
connectionToBookDB.connect();
var bookDB = null;
connectionToBookDB.query('SELECT * from book_info', function (error, results, fields) {
  if (error) throw error;
  bookDB = results;
});

const connectionToUserDB = mysql.createConnection({
  host: 'localhost',
  user: 'user_manager',
  password: '1234',
  database: 'user_db'
});
connectionToUserDB.connect();
var userDB = null;
connectionToUserDB.query('SELECT * from user_info', function (error, results, fields) {
  if (error) throw error;
  userDB = results;
});

// book_post_db 스키마에 대한 관리자를 추가한 연결 설정
const connectionToBookPostDB = mysql.createConnection({
  host: 'localhost',
  user: 'book_post_manager',
  password: 'password123',
  database: 'book_post_db'
});
connectionToBookPostDB.connect();

// === WEB ===
// FOR PARSING JSON
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({limit: '100mb', extended: false}));
// CORS OFF
app.use(cors());

// === BOOK POST ROUTES ===
// Get all the posts from book_post_db
app.get('/book_post_db/posts', function(req, res) {
  connectionToBookPostDB.query('SELECT * FROM post', function (error, results) {
    if (error) throw error;
    res.json(results);
  });
});

// Post new post to book_post_db
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

  console.log("req.body: ", req.body);

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

app.post('/classification', async function(req, res) {
  var images = req.body.insertImage;

  console.log('Ollama test is processing now!');

  const response = await ollama.generate({
    model: 'llava',
    prompt: "The given image is the cover image of a used book. Answer 'Great' if it's in a new state, 'Normal' if it's damaged enough to have problems reading, and 'Bad' if it's damaged enough to have problems reading. You should answer out of 'Great', 'Normal', 'Bad'. There is no need to explain the others.",
    images: [images],
  });

  res.json(response);
});

// === SERVER LISTENING ===
const httpServer = http.createServer(app).listen(4000, console.log("server start!"));
const socketServer = io(httpServer, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});

socketServer.on("connection", (socket) => {
	console.log(`socket connected!\nsocket id: ${socket.id}\n`);

  // handle join/leave chat room
  socket.on("join", (roomKey) => {
    console.log(`${socket.id} entered room named '${roomKey}'`);
    socket.join(roomKey);
    socket.roomKey = roomKey;
  })
  socket.on("leave", (roomKey) => {
    socket.leave(roomKey);
  })

  // handle chat
  socket.on("chat", (msg) => {
    console.log(socket.rooms);
    socket.to(socket.roomKey).emit("chat", msg);
  })
});