const mysql = require('mysql');
const http = require("http");
const express = require('express');
const app = express();
const cors = require('cors');
const io = require('socket.io');
const { default: ollama } = require('ollama');
const jwt = require('jsonwebtoken');
const { ACCESS_SECRET, REFRESH_SECRET } = require('./env.js');
const cookieParser = require('cookie-parser');

// === DATABASE CONNECTIONS ===
const connectionToBookDB = mysql.createConnection({
  host: 'localhost',
  user: 'librarian',
  password: '1234',
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
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(cookieParser());

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
app.post('/book_post_db/search', function(req, res) {
  const keyword = req.body.keyword;
  const sql = `SELECT * FROM post WHERE book_title='${keyword}' OR author='${keyword}'`

  connectionToBookPostDB.query(sql, function(error, results, fields) {
    if(error) throw error;

    res.json(results);
  });
});

// === CORRECTION NEEDED !!! ===
app.get('/book_db/book_info', function(req,res) {
  connectionToBookDB.query("SELECT * FROM book_info", function(error, results, fields) {
    res.json(results);
  })
});

// Login with JWT
app.post('/accessTokenCheck', function(req, res) {
  // Check for existence login cookie
  try {
    const token = req.cookies.accessToken;
    const data = jwt.verify(token, ACCESS_SECRET);
    connectionToUserDB.query(`SELECT * FROM user_info WHERE id='${data.id}' AND PWD='${data.password}'`, function (error, results, fields) {
      if(error) {
        throw error;
      } else if (results != '') {
        res.json(data.id);
      } else {
        res.json('');
      }
    });
  } catch (error) {
    res.json('');
  }
});
app.post('/user_db/user_info', function(req, res) {
  connectionToUserDB.query(`SELECT * FROM user_info WHERE id='${req.body.id}' AND pwd='${req.body.password}'`, function (error, results, fields) {    
    if (error) {
      throw error;
    } else if (results != '') {
      // Create JWT
      const accessToken = jwt.sign({
        id: req.body.id,
        password: req.body.password,
      }, ACCESS_SECRET, {
        expiresIn: "5m",
        issuer: "9012"
      });
      const refreshToken = jwt.sign({
        id: req.body.id,
        password: req.body.password,
      }, REFRESH_SECRET, {
        expiresIn: "24h",
        issuer: "9012"
      });
  
      // SEND JWT to client
      res.cookie("accessToken", accessToken, {
        secure: false,
        httpOnly: true,
      });
      res.cookie("refreshToken", refreshToken, {
        secure: false,
        httpOnly: true,
      });
  
      res.json(true);
    } else {
      res.json(false);
    }
  });
});
app.post('/logout', function(req, res) {
  try {
    res.cookie("accessToken", '');
    res.json(true);
  } catch (error) {
    console.log(error);
    res.json(false);
  }
})

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
		origin: "http://localhost:3000",
		methods: ["GET", "POST"]
	}
});

socketServer.on("connection", (socket) => {
	console.log(`\nsocket connected!\n`);

  // handle join/leave chat room
  socket.on("join", (roomKey) => {
    // console.log(`${socket.id} entered room named '${roomKey}'`);
    socket.join(roomKey);
    socket.roomKey = roomKey;
  })
  socket.on("leave", (roomKey) => {
    socket.leave(roomKey);
  })

  // handle chat
  socket.on("chat", (msg) => {
    socket.to(socket.roomKey).emit("chat", msg);
  })
});