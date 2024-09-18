require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }));

//db connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//Schemas
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  },
  log: [{ description: String, duration: Number, date: Date }]
})

//exclude __v versioning when sending Json to the Client.
UserSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    delete ret.__v;
    return ret;
  }
})

//Models

const UserModel = mongoose.model('Users', UserSchema);
//Dto
const createExerciseDto = async (user, exercise) => {
  return {
    username: user.username,
    date: exercise.date,
    duration: parseInt(exercise.duration),
    _id: user._id,
    description: exercise.description
  }
}
const createUserDto = async (user, logs) => {
  return {
    _id: user._id,
    username: user.username,
    count: logs.length,
    log: logs
  }
}

//user Crud methods
const createUser = (async (name) => {
  try {
    const user = new UserModel({
      username: name
    });
    return await user.save();
  } catch (error) {
    throw new Error('Error while creating new User');
  }
});

const getAllUsers = async () => {
  try {
    return await UserModel.find({}, 'username _id');
  } catch (error) {
    throw new Error('Error while fetching all users');
  }
};

const getUserLog = async (id) => {
  const user = await UserModel.findById(id, {
    'log._id': 0 // Exclude all exercices _id in log.
  });
  return user;
}


//Excercises crud methods
const createExcercise = async (exercise, id) => {
  const { description, duration, date } = exercise
  console.log(exercise);

  try {
    const user = await UserModel.findById(id);
    if (!user) return { error: 'No user' };
    const newExcercise = {
      description,
      duration: parseInt(duration),
      date: date ? new Date(new Date(date).setDate(new Date(date).getDate() + 1)).toDateString() : new Date().toDateString() //The +1 day is the shorter way i found to solve timezone conflicts
    };
    user.count++
    user.log.push(newExcercise);
    await user.save();
    return await createExerciseDto(user, newExcercise);
  } catch (error) {
    console.error(error);
    throw new Error('Error while creating new Excercise');
  }
};


//routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  try {
    const user = await createUser(username);
    if (user) {
      res.json(user);
    }
  } catch (error) {
    res.json({ error: "error creating the user" });
  }
})
app.get('/api/users', async (req, res) => {
  const userList = await getAllUsers();
  res.json(userList);
})

app.post('/api/users/:_id/exercises', async (req, res) => {
  console.table(req.body);
  const { _id } = req.params;
  try {
    const excercise = await createExcercise(req.body, _id);
    if (excercise) return res.json(excercise);
  } catch (error) {
    console.error(error);
    res.json({ error: "error while creating the excercise" });
  }
})

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  //retrieve query params
  const { from, to, limit } = req.query;
  try {
    let user = await getUserLog(_id);

    if (user) {
      let logs = user.log
      //First will filter if true query params
      if (from) {
        logs = logs.filter(e => new Date(e.date) >= new Date(from))
      }
      if (to) {
        logs = logs.filter(e => new Date(e.date) <= new Date(to))
      }
      if (limit) {
        logs = logs.slice(0, limit)
      }
      //iterate over the resulting array of exercises parsing their Date to DateString (had to add +1 day because of timezone diff)
      logs = logs.map(e => ({
        description: e.description,
        duration: e.duration,
        date: new Date(new Date(e.date).setDate(new Date(e.date).getDate() + 1)).toDateString()
      }))

      //call to DTO
      const userDto = await createUserDto(user, logs);

      res.json(userDto);
    }
  } catch (error) {
    res.json({ error: "error obtaining the user log" });
  }
})




const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
