const express = require("express");
const fs = require("fs");
const app = express();
require("dotenv").config();
const cors = require("cors");
const path = require("path");
const sharp = require("sharp");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { query } = require("express");
require("dotenv").config();
const ObjectId = require("mongodb").ObjectId;
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());
const UPLOADS_FOLDER = "./public/images";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_FOLDER);
  },
  filename: (req, file, cb) => {
    const { category } = req.query;
    const fileExt = path.extname(file.originalname);
    let fileName;
    if (category) {
      fileName = category + "-" + Date.now();
      cb(null, fileName + fileExt);
    } else {
      fileName =
        file.originalname
          .replace(fileExt, "")
          .toLowerCase()
          .split(" ")
          .join("-") +
        "-" +
        Date.now();
      cb(null, fileName + fileExt);
    }
  },
});
let upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg"
    ) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});
const deleteImage = (fileName) => {
  fs.unlinkSync(`./public/images/${fileName}`);
};
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tu097d5.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
app.get("/", (req, res) => {
  res.send("Hello I am from the ");
});

async function run() {
  try {
    await client.connect();
    const eventCollection = client.db("ait-website").collection("events");
    const instructorCollection = client
      .db("ait-website")
      .collection("instructors");
    const sliderCollection = client.db("ait-website").collection("sliders");
    const postCollection = client.db("ait-website").collection("posts");
    const courseCollection = client.db("ait-website").collection("courses");
    const userCollection = client.db("ait-website").collection("users");
    const serviceCollection = client.db("ait-website").collection("services");
    const messageCollection = client.db("ait-website").collection("messages");
    const reviewCollection = client.db("ait-website").collection("reviews");
    const requestCollection = client.db("ait-website").collection("request");

    // app.use(express.static("public"));
    app.use("/public/images", express.static("public/images"));

    function verifyJWT(req, res, next) {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(" ")[1];
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      jwt.verify(token, process.env.ACCESS_SECRET, function (err, decoded) {
        if (err) {
          return res
            .status(403)
            .send({ message: "forbidden access from middleware" });
        }
        req.decoded = decoded;
        next();
      });
    }

    // verify user
    app.get("/verify-jwt/:accessToken", async (req, res) => {
      const token = req.params.accessToken;
      jwt.verify(
        token,
        process.env.ACCESS_SECRET,
        async function (err, decoded) {
          if (err) {
            res.status(403).send({ message: "forbidden access", status: true });
          } else {
            const query = { email: decoded?.email };
            const result = await userCollection.findOne(query);
            if (result?.email && !result?.disabled) {
              res.status(200).send({ message: "success", status: false });
            } else {
              res
                .status(403)
                .send({ message: "forbidden access", status: true });
            }
          }
        }
      );
    });

    // provide jwttoken
    app.get("/login/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      token = jwt.sign({ email: email }, process.env.ACCESS_SECRET, {
        expiresIn: "2d",
      });
      res.send({ accessToken: token });
    });
    // ##############
    // upload section
    // ##############
    // upload images
    app.post(
      "/upload/images",
      upload.fields([
        { name: "image", maxCount: 1 },
        { name: "thumnail", maxCount: 1 },
      ]),
      (req, res) => {
        res.send(req.files);
      }
    );
    // upload single image
    app.post("/upload/image", upload.single("image"), (req, res) => {
      res.send(req.file);
    });
    // ##############
    // course section
    // ##############
    // get all courses
    app.get("/courses", async (req, res) => {
      const cursor = courseCollection.find();
      const courses = await cursor.toArray();
      res.send(courses);
    });
    // get single course
    app.get("/course/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const course = await courseCollection.findOne(query);
      const instructor = await instructorCollection.findOne({
        _id: ObjectId(course.instructor),
      });
      res.send({ course, instructor });
    });
    // insert single course
    app.post("/course", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      const image = doc.img;
      const thumb = doc.thumb;
      const resizedImage = image.replace("-", "-res-");
      const resizedThumb = thumb.replace("-", "-thumb-res-");
      await sharp(`./public/images/${image}`)
        .resize({
          fit: "fill",
          width: 1940,
          height: 946,
        })
        .toFile(`./public/images/${resizedImage}`);
      await sharp(`./public/images/${thumb}`)
        .resize({
          fit: "fill",
          width: 420,
          height: 230,
        })
        .toFile(`./public/images/${resizedThumb}`);
      // delete main image after resize
      deleteImage(image);
      // replace image name in database
      doc.img = resizedImage;
      doc.thumb = resizedThumb;
      //  add instructor information
      const query = { _id: ObjectId(doc.instructor) };
      const instructor = await instructorCollection.findOne(query);
      doc.instructorImg = instructor.img;
      if (decoded.email === email) {
        const result = await courseCollection.insertOne(doc);
        res.send(result);
      } else {
        deleteImage(doc.img);
        deleteImage(doc.thumb);
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // update course status
    app.put("/course/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const courseId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(courseId) };
      const update = { $set: { disabled: doc.status } };
      if (decoded.email === email) {
        const result = await courseCollection.updateOne(filter, update);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // delete single course
    app.delete("/course/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const courseId = req.params.id;
      const query = { _id: ObjectId(courseId) };
      const course = await courseCollection.findOne(query);
      const img = course.img;
      const thumb = course.thumb;
      if (decoded.email === email) {
        const result = await courseCollection.deleteOne(query);
        if (result.deletedCount) {
          deleteImage(img);
          deleteImage(thumb);
        }
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ###############
    // service section
    // ###############
    // get all service
    app.get("/services", async (req, res) => {
      const cursor = serviceCollection.find();
      const services = await cursor.toArray();
      res.send(services);
    });
    // insert single service
    app.post("/service", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      if (decoded.email === email) {
        const result = await serviceCollection.insertOne(doc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // delete single slider
    app.delete("/service/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const serviceId = req.params.id;
      const query = { _id: ObjectId(serviceId) };
      if (decoded.email === email) {
        const result = await serviceCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // update service status
    app.put("/service/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const serviceId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(serviceId) };
      const update = { $set: { disabled: doc.status } };
      if (decoded.email === email) {
        const result = await serviceCollection.updateOne(filter, update);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // #############
    // event section
    // #############
    // get all events
    app.get("/events", async (req, res) => {
      const cursor = eventCollection.find();
      const events = await cursor.toArray();
      res.send(events);
    });
    // get 3 latest event
    app.get("/latest-events", async (req, res) => {
      const cursor = eventCollection.find().sort({ date: -1 }).limit(3);
      const events = await cursor.toArray();
      res.send(events);
    });
    // get single event
    app.get("/event/:eventId", async (req, res) => {
      const eventId = req.params.eventId;
      const query = { _id: ObjectId(eventId) };
      const result = await eventCollection.findOne(query);
      res.send(result);
    });
    // insert a single event
    app.post("/event", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      const image = doc.img;
      const thumb = doc.thumb;
      const resizedImage = image.replace("-", "-res-");
      const resizedThumb = thumb.replace("-", "-thumb-res-");
      await sharp(`./public/images/${image}`)
        .resize({
          fit: "fill",
          width: 800,
          height: 420,
        })
        .toFile(`./public/images/${resizedImage}`);
      await sharp(`./public/images/${thumb}`)
        .resize({
          fit: "fill",
          width: 380,
          height: 302,
        })
        .toFile(`./public/images/${resizedThumb}`);
      // delete main image after resize
      deleteImage(image);
      // replace image name in database
      doc.img = resizedImage;
      doc.thumb = resizedThumb;
      if (decoded.email === email) {
        const result = await eventCollection.insertOne(doc);
        res.send(result);
      } else {
        deleteImage(doc.img);
        deleteImage(doc.thumb);
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // delete single event
    app.delete("/event/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const eventId = req.params.id;
      const query = { _id: ObjectId(eventId) };
      const event = await eventCollection.findOne(query);
      const img = event.img;
      const thumb = event.thumb;
      if (decoded.email === email) {
        deleteImage(img);
        deleteImage(thumb);
        const result = await eventCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ############
    // post section
    // ############
    // get all post
    app.get("/posts", async (req, res) => {
      const cursor = postCollection.find();
      const posts = await cursor.toArray();
      res.send(posts);
    });

    // get 3 latest post
    app.get("/latest-posts", async (req, res) => {
      const cursor = postCollection.find().sort({ date: -1 }).limit(3);
      const posts = await cursor.toArray();
      res.send(posts);
    });

    // get single post
    app.get("/post/:postId", async (req, res) => {
      const postId = req.params.postId;
      const query = { _id: ObjectId(postId) };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // insert single post
    app.post("/post", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      const image = doc.img;
      const resizedImage = image.replace("-", "-res-");
      await sharp(`./public/images/${image}`)
        .resize({
          fit: "fill",
          width: 853,
          height: 420,
        })
        .toFile(`./public/images/${resizedImage}`);
      // delete main image after resize
      deleteImage(image);
      // replace image name in database
      doc.img = resizedImage;
      if (decoded.email === email) {
        const result = await postCollection.insertOne(doc);
        res.send(result);
      } else {
        deleteImage(doc.img);
        res.status(403).send({ message: "forbidden access" });
      }
    });

    // delete single post
    app.delete("/post/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const postId = req.params.id;
      const query = { _id: ObjectId(postId) };
      const post = await postCollection.findOne(query);
      if (decoded.email === email) {
        deleteImage(post.img);
        const result = await postCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ##################
    // instructor section
    // ##################
    // insert a single instructor
    app.post("/instructor", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      const image = doc.img;
      const resizedImage = image.replace("-", "-res-");
      await sharp(`./public/images/${image}`)
        .resize({
          fit: "fill",
          width: 270,
          height: 274,
        })
        .toFile(`./public/images/${resizedImage}`);
      // delete main image after resize
      deleteImage(image);
      // replace image name in database
      doc.img = resizedImage;
      if (decoded.email === email) {
        const result = await instructorCollection.insertOne(doc);
        res.send(result);
      } else {
        deleteImage(doc.img);
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // get all instructors
    app.get("/instructors", async (req, res) => {
      const cursor = instructorCollection.find();
      const instructors = await cursor.toArray();
      res.send(instructors);
    });
    // delete single instructors
    app.delete("/instructor/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const instructorId = req.params.id;
      const query = { _id: ObjectId(instructorId) };
      const instructor = await instructorCollection.findOne(query);
      const image = instructor.img;
      if (decoded.email === email) {
        const result = await instructorCollection.deleteOne(query);
        if (result.deletedCount) {
          deleteImage(image);
        }
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ##############
    // slider section
    // ##############
    // insert single slider
    app.post("/slider", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      const image = doc.img;
      const resizedImage = image.replace("-", "-res-");
      await sharp(`./public/images/${image}`)
        .resize({
          fit: "fill",
          width: 1920,
          height: 946,
        })
        .toFile(`./public/images/${resizedImage}`);
      // delete main image after resize
      deleteImage(image);
      // replace image name in database
      doc.img = resizedImage;
      if (decoded.email === email) {
        const result = await sliderCollection.insertOne(doc);
        res.send(result);
      } else {
        deleteImage(doc.img);
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // delete single slider
    app.delete("/slider/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const sliderId = req.params.id;
      const query = { _id: ObjectId(sliderId) };
      const slider = await sliderCollection.findOne(query);
      if (decoded.email === email) {
        deleteImage(slider.img);
        const result = await sliderCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // get all slider
    app.get("/sliders", async (req, res) => {
      const cursor = sliderCollection.find();
      const sliders = await cursor.toArray();
      res.send(sliders);
    });
    // ##############
    // review section
    // ##############
    // get reviews by course id
    app.get("/reviews", async (req, res) => {
      const { courseId } = req.query;
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      if (courseId) {
        const reviews = result.filter((r) => r.courseId === courseId);
        res.send(reviews);
      } else {
        res.send(result);
      }
    });
    // update review status
    app.put("/review/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const reviewId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(reviewId) };
      const update = { $set: { disabled: doc.status } };
      if (decoded.email === email) {
        const result = await reviewCollection.updateOne(filter, update);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // insert single review
    app.post("/review", async (req, res) => {
      const doc = req.body;
      doc.disabled = false;
      const result = await reviewCollection.insertOne(doc);
      res.send(result);
    });
    // delete single review
    app.delete("/review/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const reviewId = req.params.id;
      const query = { _id: ObjectId(reviewId) };
      if (decoded.email === email) {
        const result = await reviewCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ############
    // user section
    // ############
    // get all users
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const users = await cursor.toArray();
      res.send(users);
    });
    // get single user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    // insert single user
    app.post("/user", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const doc = req.body;
      doc.disabled = false;
      if (decoded.email === email) {
        const result = await userCollection.insertOne(doc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // delete single user
    app.delete("/user/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const userId = req.params.id;
      const query = { _id: ObjectId(userId) };
      if (decoded.email === email) {
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // update user status
    app.put("/user/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const userId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(userId) };
      const update = { $set: { ...doc } };
      if (decoded.email === email) {
        const result = await userCollection.updateOne(filter, update);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ###############
    // request section
    // ###############
    // get all request
    app.get("/requests", async (req, res) => {
      const cursor = requestCollection.find().sort({ date: -1 }).limit(3);
      const result = await cursor.toArray();
      res.send(result);
    });
    // update seen status of request
    app.put("/request/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const requestId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(requestId) };
      const update = { $set: { seen: doc.seen } };
      if (decoded.email === email) {
        const result = await requestCollection.updateOne(filter, update);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    // insert a single request
    app.post("/request", async (req, res) => {
      const doc = req.body;
      doc.seen = false;
      const result = await requestCollection.insertOne(doc);
      res.send(result);
    });

    // delete single review
    app.delete("/request/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const requestId = req.params.id;
      const query = { _id: ObjectId(requestId) };
      if (decoded.email === email) {
        const result = await requestCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // ###############
    // message section
    // ###############
    // get all message
    app.get("/messages", async (req, res) => {
      const cursor = messageCollection.find().sort({ date: -1 }).limit(3);
      const result = await cursor.toArray();
      res.send(result);
    });

    // insert single message
    app.post("/message", async (req, res) => {
      const doc = req.body;
      doc.seen = false;
      const result = await messageCollection.insertOne(doc);
      res.send(result);
    });

    // delete single message
    app.delete("/message/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const messageId = req.params.id;
      const query = { _id: ObjectId(messageId) };
      if (email === decoded.email) {
        const result = await messageCollection.deleteOne(query);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });

    // update message status
    app.put("/message/:id", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      const { email } = req.query;
      const messageId = req.params.id;
      const doc = req.body;
      const filter = { _id: ObjectId(messageId) };
      const update = { $set: { seen: doc.seen } };
      if (email === decoded.email) {
        const result = await messageCollection.updateOne(filter, update);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden access" });
      }
    });
    // delete an image
  } finally {
    // await client.connect();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log("Server is running on port", port);
});
