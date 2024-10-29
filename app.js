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
 password: 'password123',    // 새로 생성된 사용자의 비밀번호
 database: 'book_post_db'
});
connectionToBookPostDB.connect();

// === WEB ===
// FOR PARSING JSON
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: false }));
// CORS OFF
app.use(cors());

// === BOOK POST ROUTES ===
// book_post_db에서 모든 게시글 가져오기
app.get('/book_post_db/posts', function (req, res) {
 connectionToBookPostDB.query('SELECT * FROM post', function (error, results) {
  if (error) throw error;
  res.json(results);
 });
});

// book_post_db에 새로운 게시글 추가하기
app.post('/book_post_db/posts', function (req, res) {
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
app.get('/user_db/user_info', function (req, res) {
 connectionToUserDB.query('SELECT * from user_info', function (error, results, fields) {
  if (error) throw error;
  userDB = results;
  res.json(userDB);
 });
});

// === CORRECTION NEEDED !!! ===
app.get('/book_db/book_info', function (req, res) {
 connectionToBookDB.query("SELECT * FROM book_info", function (error, results, fields) {
  res.json(results);
 })
});

// Login with JWT
app.get('/accessTokenCheck', function (req, res) {
 // Check for existence login cookie
 try {
  const token = req.cookies.accessToken;
  const data = jwt.verify(token, ACCESS_SECRET);
  connectionToUserDB.query(`SELECT * FROM user_info WHERE id='${data.id}' AND PWD='${data.password}'`, function (error, results, fields) {
   if (error) {
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
app.get('/refreshTokenCheck', function (req, res) {
 // Check for existence login cookie
 try {
  const token = req.cookies.refreshToken;
  const data = jwt.verify(token, REFRESH_SECRET);
  connectionToUserDB.query(`SELECT * FROM user_info WHERE id='${data.id}' AND PWD='${data.password}'`, function (error, results, fields) {
   if (error) {
    throw error;
   } else if (results != '') {
    // Create new access token
    const accessToken = jwt.sign({
     id: data.id,
     password: data.password,
    }, ACCESS_SECRET, {
     expiresIn: "5m",
     issuer: "9012"
    });

    res.cookie("accessToken", accessToken, {
     secure: false,
     httpOnly: true,
    });

    res.json(data.id);
   } else {
    res.json('');
   }
  });
 } catch (error) {
  res.json('');
 }
});
app.post('/user_db/user_info', function (req, res) {
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
app.post('/logout', function (req, res) {
 try {
  res.cookie("accessToken", '');
  res.json(true);
 } catch (error) {
  console.log(error);
  res.json(false);
 }
})

app.post('/signin', express.json(), function (req, res) {
 var sql = 'INSERT INTO user_db.user_info (id, pwd, email) VALUES(?,?,?)';
 var param = [req.body.insertId, req.body.insertPassword, req.body.insertEmail];

 connectionToUserDB.query(sql, param, (error, rows, fields) => {
  if (error) throw error;
 });
});

app.post('/classification', async function (req, res) {
 let images = [];
 
 // Copying for 'array-like objects' (*유사 배열)
 for(let i = 0; i < images.length; i++) {
  images.push(req.body.insertImages[i]);
 }

 console.log("ollama is running!");

 const response = await ollama.generate({
  model: 'llava',
  prompt: "The given image is the cover image of a used book. Answer 'Great' if it's in a new state, 'Normal' if it's damaged enough to have problems reading, and 'Bad' if it's damaged enough to have problems reading. You should answer out of 'Great', 'Normal', 'Bad'. You don't need to explain why.",
  images: images,
 });

 res.json(response);
});

app.get('/user_db/user_info', function (req, res) {
 connectionToUserDB.query("SELECT * FROM user_info", function (error, results, fields) {
  try {
   res.json(results);
  } catch (error) {
   console.log(error);
  }
 });
})

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
 // chat을 emit한 소켓이 속한 룸 구분
 socket.on("chat", (msg) => {
  console.log(socket.rooms);
  socket.to(socket.roomKey).emit("chat", msg);
 })
});

// 사용자의 찜한 게시물 목록 조회
app.post('/user/favorites', (req, res) => {
 const { userId } = req.body;

 connectionToUserDB.query(
  'SELECT favorite_post_ids FROM user_info WHERE id = ?',
  [userId],
  (error, results) => {
   if (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
   } else {
    const favoritePostIds = JSON.parse(results[0]?.favorite_post_ids || '[]');
    res.status(200).json({ success: true, favoritePostIds });
   }
  }
 );
});

app.post('/favorites', (req, res) => {
 const { userId, postId, action } = req.body;

 connectionToUserDB.query(
  'SELECT favorite_post_ids FROM user_info WHERE id = ?',
  [userId],
  (error, results) => {
   if (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
   } else {
    const favoritePostIds = JSON.parse(results[0]?.favorite_post_ids || '[]');

    if (action === 'add' && !favoritePostIds.includes(postId)) {
     favoritePostIds.push(postId);
    } else if (action === 'remove') {
     const index = favoritePostIds.indexOf(postId);
     if (index !== -1) favoritePostIds.splice(index, 1);
    }

    connectionToUserDB.query(
     'UPDATE user_info SET favorite_post_ids = ? WHERE id = ?',
     [JSON.stringify(favoritePostIds), userId],
     (updateError) => {
      if (updateError) {
       console.error(updateError);
       res.status(500).json({ success: false, message: 'Server Error' });
      } else {
       // 실시간 반영을 위해 소켓 이벤트 emit
       socketServer.emit('favoriteUpdated', { userId, postId, action });
       res.status(200).json({ success: true, favoritePostIds });
      }
     }
    );
   }
  }
 );
});

app.get('/book_post_db/posts', function (req, res) {
 connectionToBookPostDB.query('SELECT * FROM post', function (error, results) {
   if (error) {
     console.error(error);
     res.status(500).json({ success: false, message: 'Server error' });
   } else {
     const formattedResults = results.map(post => ({
       ...post,
       image_urls: post.image_urls ? JSON.parse(post.image_urls).slice(0, 4) : []
     }));
     res.json(formattedResults);
   }
 });
});