require('dotenv').config();
const express = require('express');
const cors = require('cors');
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


// users API
        app.get('/users', async (req, res) => {
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

        //get instructor info
        app.get('/instructor', async (req, res) => {
            const query = {};
            const cursor = instructorCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        // cart collection
        
     
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
      
            if (!email) {
              res.send([]);
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