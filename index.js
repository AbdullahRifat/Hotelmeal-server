const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()


//stipe

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

var jwt = require('jsonwebtoken');




// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jxdqwus.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();

    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewCollection = client.db("bistroDb").collection("reviews");
    const cartCollection = client.db("bistroDb").collection("carts");
    const userCollection = client.db("bistroDb").collection("users");
    const paymentCollection = client.db("bistroDb").collection("payments");
    


    //middlewires
    const verifyToken = (req, res, next) => {
     
      if (!req.headers.authorization) {
        return res.status(401).send({
          message: "forbidden acess"
        })
      }
      const token = req.headers.authorization.split(' ')[1]
     

      // verify a token symmetric
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if(err) return res.status(401).send({ message :'forbidden acess' })
        req.decoded = decoded
        next()
      });
     
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role==='admin'

      if(!isAdmin){
        return res.status(401).send({ message: 'forbidden acess'})
      }
      next()
    }

    //jwt related 


    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    ///

    
    //admin 



    //
    app.get("/users", verifyToken,verifyAdmin, async (req, res) => {
   
      const result = await userCollection.find().toArray()
      res.send(result);
    })

   
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })


    app.delete("/users/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await userCollection.deleteOne(query);

      res.send(result);

    })

    app.patch("/users/admin/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id
     
      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);


      res.send(result)


    })
    //users
    app.post("/users", async (req, res) => {

      const user = req.body;

      const query = { email: user.email }

      const isExits = await userCollection.findOne(query)

      if (isExits) {
        return res.send({ message: "user already exists", isertedId: null })
      }

      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })


    //scrooling
    app.get('/menu/scroll', async (req, res) => {
      const page = parseInt(req.query.page, 10) || 1;
      const perWindow = parseInt(req.query.perWindow, 10) || 6;
    
      try {
        const totalItems = await menuCollection.countDocuments();
    
        const items = await menuCollection
          .find({})
          .skip((page - 1) * perWindow)
          .limit(perWindow)
          .toArray();
    
        const hasMore = totalItems > page * perWindow;
    
        res.json({ items, hasMore });
      } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).send('Error fetching menu items');
      }
    });
    
    
    app.post('/menu',verifyToken,verifyAdmin, async (req, res) => {
     const item = req.body;
     const result = await menuCollection.insertOne(item);
     res.send(result);
    })

    app.delete('/menu:id',verifyToken,verifyAdmin, async (req,res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)} 
        const result = await menuCollection.deleteOne(query)
        res.send(result);
    })
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result);
    })



    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    // carts collection
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
  //stripe

  app.post('/create-payment-intent', async (req, res) => {

      const {price} = req.body;
      const amount = parseInt(price*100);
     console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types:[
          "card"
        ]
      })
     
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
      

  })

  app.post('/payments',verifyToken,async(req, res) => {
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);
   
    const query = {_id:{
      $in: payment.cartIds.map(id=>new ObjectId(id))
    }}

    const deleteResult = await cartCollection.deleteMany(query);
   
res.send({paymentResult,deleteResult})

  })



app.get('/payments', verifyToken, async (req, res) => {
    const userEmail = req.query.email;

    if (!userEmail) {
        return res.status(400).json({ error: 'Email parameter is missing' });
    }

    const query = { email: userEmail };

    try {
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});



    //users collection

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
  res.send('server is ok')
})

app.listen(port, () => {
  console.log(`Hotel server  running port ${port}`);
})

