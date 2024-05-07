const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;


// middleware //
app.use(cors({
  origin: ['http://localhost:5174'],
  credentials: true
}))
app.use(express.json());
app.use(cookieParser())

console.log(process.env.DB_PASS)
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nshaxle.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middlewares 
const logger = async(req, res, next) => {
  console.log('called these', req.host, req.originalUrl);

  next();
}
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('value of token in middleware', token);
   if(!token){
    return res.status(401).send({message: 'not authorized'})
   }
   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'unauthorized'})
    }
    req.user = decoded;
    console.log('value of the token', decoded)
    next()
   })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //-------------------AUTH RELATED API ------------------------//
    app.post('/jwt', logger, async(req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res
      .cookie("token", token , {
        httpOnly: true,
        secure: false
      })

      .send({success: true})
    })
 


    //-------------------SERVICE RELATED API-------------------------//
    const servicesCollection = client.db('carDoctor').collection('services');
    const orderCollection = client.db('carDoctor').collection('order');
   //_______________All services load_______________________// 
    app.get('/services', logger, async(req, res) => {
      const query = servicesCollection.find();
      const result = await query.toArray();
      res.send(result)
    });
    //_________________ A specific service load___________ //
    app.get('/services/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const options = {
        // Include only the title and price fields in each returned document
        projection: {title: 1, price: 1, img: 1 }
      };
      const result = await servicesCollection.findOne(query, options);
      res.send(result)
    })
    // ____________post a order_________________//
    app.post('/order', async(req, res) => {
      const order = req.body;
      // console.log(order);
      const result = await orderCollection.insertOne(order);
      res.send(result)
    })
    // _______get orders of specific email___________//
    app.get('/order', logger, verifyToken,  async (req, res) => {
      console.log('from valid token', req.user)
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const result = await orderCollection.find(query).toArray();
      res.send(result)
    })
    // ____________delete a order_____________________//
    app.delete('/order/:id', async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await orderCollection.deleteOne(query);
      res.send(result)
    });
    app.patch('/order/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const orderUpdate = req.body;
      console.log(orderUpdate);
      const updateDoc = {
        $set: {
          status: orderUpdate.status
        },
      };
      const result = await orderCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`doctor server is running on the port ${port}`);
})