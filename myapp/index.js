import express from 'express';
import routes from './src/routes/crmRoutes';
import mongoose from 'mongoose';
// import bodyParser from 'body-parser';
// const messages = require("./ups_pb");
const app = express();
const PORT = 8000;

// mongoose connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://127.0.0.1/CRMdb',{
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.catch(err => console.log( err ))
.then(() => console.log( 'Database Connected' ));


//bodyparser setup
app.use(express.urlencoded({extended: true})); // .urlencoded indicates that we are parsing URL encoded data from the body. 
app.use(express.text());

// ehs vuew ebgube
var path = require('path')
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')


routes(app);

app.get('/', (req, res) =>{
    //res.send(`Node and express server running on port ${PORT}`);
     res.render(__dirname + '/pages/index.ejs');
});

app.get('/login', (req, res) =>{
    res.render(__dirname + '/pages/login.ejs', {"error": false});
});

app.get('/signup', (req, res) =>{
    res.render(__dirname + '/pages/signup.ejs', {"error": false});
});

app.get('/personal', (req, res) =>{
    res.render(__dirname + '/pages/personal.ejs', {"exist": false, "userid" : 0});
});


app.listen(PORT, () =>
    console.log(`Your server is running on port ${PORT}`)
);


// var message = new messages.UConnect();
// message.setWorldid(1);
// console.log(message.getWorldid())