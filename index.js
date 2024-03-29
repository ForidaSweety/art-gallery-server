require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5005;

// middleware
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status().send({ error: true, message: 'unauthorized access' });
    }
   
    const token = authorization.split(' ')[1];
  
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
      }
      req.decoded = decoded;
      next();
    })
  }



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6hr4bdc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //await client.connect();

        const usersCollection = client.db('artGallery').collection('users');
        const classesCollection = client.db('artGallery').collection('classes');
        const instructorCollection = client.db('artGallery').collection('instructor');
        const cartCollection = client.db('artGallery').collection('carts');
        const paymentCollection = client.db("artGallery").collection("payments");



        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      
            res.send({ token })
          })


        //  verifyJWT before using verifyAdmin 
          const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
              return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
          }

// users API
        app.get('/users',verifyJWT,verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
          });

     //create user  
     app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await usersCollection.findOne(query);
  
        if (existingUser) {
          return res.send({ message: 'user already exists' })
        }
  
        const result = await usersCollection.insertOne(user);
        res.send(result);
      });

// check user is admin !
      app.get('/users/admin/:email', verifyJWT, async (req, res) => {
        const email = req.params.email;
  
        if (req.decoded.email !== email) {
          res.send({ admin: false })
        }
  
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        const result = { admin: user?.role === 'admin' }
        res.send(result);
      })

      app.patch('/users/admin/:id', async (req, res) => {
        const id = req.params.id;
        console.log(id);
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: 'admin'
          },
        };
  
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
  
      })



        ///get all the classes info
        app.get('/classes', async (req, res) => {
            const query = {}
            const options = {
                sort: { "num_of_student": -1 }
            }
            const cursor = classesCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        })




        // app.get('/classes', async (req, res) => {
        //     const result = await classesCollection.find().toArray();
        //     res.send(result);
        //   })

          app.post('/classes', verifyJWT,verifyAdmin, async (req, res) => {
            const newClass =req.body
            const result = await classesCollection.insertOne(newClass);
            res.send(result);
          })

          app.delete('/classes/:id',verifyJWT,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCollection.deleteOne(query);
            res.send(result);
          })


        //get instructor info
        app.get('/instructor', async (req, res) => {
            const query = {};
            const cursor = instructorCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // cart collection
        
     
        app.get('/carts',verifyJWT, async (req, res) => {
            const email = req.query.email;
      
            if (!email) {
              res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
              return res.status(403).send({ error: true, message: 'porviden access' })
            }
      
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
          });



        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
          })
      
        // delete class from userCart
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
          })

  //  payment intent
  app.post('/create-payment', verifyJWT, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  })

  // payment

  app.post('/payments', verifyJWT, async (req, res) => {
    const payment = req.body;
    const insertResult = await paymentCollection.insertOne(payment);

    const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
    const deleteResult = await cartCollection.deleteMany(query)

    res.send({ insertResult, deleteResult });
  })



  app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
    const users = await usersCollection.estimatedDocumentCount();
    const selectClass = await cartCollection.estimatedDocumentCount();
    const paymentCls = await paymentCollection.estimatedDocumentCount();
    const payments = await paymentCollection.find().toArray();
    const revenue = payments.reduce( ( sum, payment) => sum + payment.price, 0)

    res.send({
      revenue,
      users,
      selectClass,
      paymentCls
    })
  })





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send(' gallery server is running...')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})