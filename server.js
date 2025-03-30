const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require('./Movies'); // You're not using Movie, consider removing it

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'jwt ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

// Define endpoints for '/movies'
router.route('/movies')
  // GET all movies
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movies = await Movie.find();
      res.json(movies);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  })
  // POST a new movie
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (!req.body.title || !req.body.releaseDate || !req.body.genre || !req.body.actors) {
        return res.status(400).json({ success: false, message: 'Missing required movie information.' });
      }
      const newMovie = new Movie(req.body);
      const savedMovie = await newMovie.save();
      res.status(201).json({ movie: savedMovie });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

// Define endpoints for '/movie/:title'
router.route('/movies/:title')
  // GET a movie by title
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movie = await Movie.findOne({ title: req.params.title });
      if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.json(movie);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  })
  // PUT update a movie by title
  .put(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const updatedMovie = await Movie.findOneAndUpdate(
        { title: req.params.title },
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedMovie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.json(updatedMovie);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  })
  // DELETE a movie by title
  .delete(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const deletedMovie = await Movie.findOneAndDelete({ title: req.params.title });
      if (!deletedMovie) return res.status(404).json({ success: false, message: 'Movie not found.' });
      res.json({ success: true, message: 'Movie deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });


app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only
