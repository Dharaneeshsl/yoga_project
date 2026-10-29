// Validated yoga levels with anatomically accurate reference angles,
// mirrored side support, side-view adaptations, tolerances, benefits, step lists, and local vector illustrations.

export const LEVELS = [
  {
    id: 1,
    name: "Tree Pose (Vṛkṣāsana)",
    sanskritName: "Vṛkṣāsana",
    image: "/poses/tree.svg",
    desc: "Balance steadily on one foot while lifting your opposite foot to your inner thigh and reaching arms gracefully overhead.",
    cameraTip: "Step back 2.5–3 meters so your feet and overhead hands are fully framed.",
    category: "Balance & Focus",
    viewOrientation: "front",
    benefits: [
      "Strengthens thighs, calves, ankles, and spine",
      "Stretches the groins, inner thighs, chest, and shoulders",
      "Improves sense of balance and mental concentration"
    ],
    steps: [
      "Stand tall in Mountain Pose with weight evenly distributed.",
      "Shift weight onto your standing leg, pressing all four corners of the foot into the mat.",
      "Bend your other knee and place the sole of your foot on your inner thigh or calf (avoid the knee joint).",
      "Bring hands to prayer at chest or extend arms straight overhead with shoulders relaxed."
    ],
    commonMistakes: [
      "Placing the foot directly on the side of the knee joint",
      "Letting the hips kick out to one side rather than staying square",
      "Collapsing the chest or hunching shoulders into the ears"
    ],
    // Primary side (Right leg raised, left leg standing)
    angles: {
      LShoulder: 165,
      RShoulder: 165,
      LElbow: 170,
      RElbow: 170,
      LHip: 175,
      RHip: 125,
      LKnee: 175,
      RKnee: 55
    },
    // Mirrored side (Left leg raised, right leg standing)
    mirroredAngles: {
      LShoulder: 165,
      RShoulder: 165,
      LElbow: 170,
      RElbow: 170,
      LHip: 125,
      RHip: 175,
      LKnee: 55,
      RKnee: 175
    },
    tolerances: {
      LShoulder: 25,
      RShoulder: 25,
      LElbow: 25,
      RElbow: 25,
      LHip: 25,
      RHip: 30,
      LKnee: 20,
      RKnee: 25
    },
    weights: {
      LShoulder: 1.1,
      RShoulder: 1.1,
      LElbow: 0.9,
      RElbow: 0.9,
      LHip: 1.2,
      RHip: 1.2,
      LKnee: 1.3,
      RKnee: 1.3
    },
    checklist: [
      {
        id: "standing_leg",
        text: "Standing leg straight & grounded",
        primaryJoint: "LKnee",
        mirroredJoint: "RKnee"
      },
      {
        id: "raised_knee",
        text: "Raised knee turned out to side",
        primaryJoint: "RKnee",
        mirroredJoint: "LKnee"
      },
      {
        id: "overhead_arms",
        text: "Arms extended overhead",
        primaryJoints: ["LShoulder", "RShoulder"]
      },
      {
        id: "elbows",
        text: "Elbows elongated",
        primaryJoints: ["LElbow", "RElbow"]
      }
    ]
  },
  {
    id: 2,
    name: "Warrior II (Vīrabhadrāsana II)",
    sanskritName: "Vīrabhadrāsana II",
    image: "/poses/warrior2.svg",
    desc: "Take a wide stance, sinking deep into your front bent knee while extending arms parallel to the floor.",
    cameraTip: "Face the camera at a slight 30° diagonal so both arms and leg depth are clearly visible.",
    category: "Strength & Stamina",
    viewOrientation: "diagonal",
    benefits: [
      "Builds stamina and strengthens legs, ankles, and back",
      "Opens hips, groins, chest, and lungs",
      "Stimulates abdominal organs and therapeutic for carpal tunnel"
    ],
    steps: [
      "Step feet 3.5 to 4 feet apart. Turn front foot out 90° and back foot slightly in.",
      "Extend both arms out parallel to the floor, palms facing down.",
      "Bend front knee directly over ankle so thigh is parallel to the floor.",
      "Keep torso centered vertically over the pelvis; gaze softly over the front fingertips."
    ],
    commonMistakes: [
      "Front knee collapsing inward past the big toe",
      "Torso leaning forward toward the bent knee instead of staying centered",
      "Back arm drooping below shoulder height"
    ],
    // Right side forward
    angles: {
      LShoulder: 92,
      RShoulder: 92,
      LElbow: 175,
      RElbow: 175,
      LHip: 165,
      RHip: 100,
      LKnee: 175,
      RKnee: 90
    },
    // Left side forward
    mirroredAngles: {
      LShoulder: 92,
      RShoulder: 92,
      LElbow: 175,
      RElbow: 175,
      LHip: 100,
      RHip: 165,
      LKnee: 90,
      RKnee: 175
    },
    tolerances: {
      LShoulder: 20,
      RShoulder: 20,
      LElbow: 20,
      RElbow: 20,
      LHip: 25,
      RHip: 25,
      LKnee: 20,
      RKnee: 20
    },
    weights: {
      LShoulder: 1.1,
      RShoulder: 1.1,
      LElbow: 0.8,
      RElbow: 0.8,
      LHip: 1.3,
      RHip: 1.3,
      LKnee: 1.4,
      RKnee: 1.4
    },
    checklist: [
      {
        id: "front_knee",
        text: "Front knee bent at ~90°",
        primaryJoint: "RKnee",
        mirroredJoint: "LKnee"
      },
      {
        id: "back_leg",
        text: "Back leg active & straight",
        primaryJoint: "LKnee",
        mirroredJoint: "RKnee"
      },
      {
        id: "arms_parallel",
        text: "Arms level with shoulders",
        primaryJoints: ["LShoulder", "RShoulder"]
      },
      {
        id: "elbows",
        text: "Arms extended straight",
        primaryJoints: ["LElbow", "RElbow"]
      }
    ]
  },
  {
    id: 3,
    name: "Downward-Facing Dog (Adho Mukha Śvānāsana)",
    sanskritName: "Adho Mukha Śvānāsana",
    image: "/poses/downward_dog.svg",
    desc: "Form an inverted V-shape, pressing firmly through hands and feet while lifting hips high to lengthen the spine.",
    cameraTip: "Position your camera from the side (profile view) for optimal spine and limb tracking.",
    category: "Inversion & Flexibility",
    viewOrientation: "side",
    benefits: [
      "Calms the brain and helps relieve stress and mild fatigue",
      "Energizes the body and strengthens the arms and legs",
      "Stretches the shoulders, hamstrings, calves, arches, and hands"
    ],
    steps: [
      "Start on hands and knees with wrists under shoulders and knees under hips.",
      "Tuck toes, lift knees off the mat, and press hips up toward the ceiling.",
      "Press hands down and forward into the mat, keeping fingers spread wide.",
      "Firm shoulder blades against your back; gently guide heels toward the mat."
    ],
    commonMistakes: [
      "Rounding the spine due to stiff hamstrings (bend knees slightly instead)",
      "Dumping all weight onto wrists rather than engaging whole hand pads",
      "Hunching shoulders up toward ears without broadening the upper back"
    ],
    angles: {
      LShoulder: 165,
      RShoulder: 165,
      LElbow: 175,
      RElbow: 175,
      LHip: 80,
      RHip: 80,
      LKnee: 172,
      RKnee: 172
    },
    tolerances: {
      LShoulder: 25,
      RShoulder: 25,
      LElbow: 22,
      RElbow: 22,
      LHip: 25,
      RHip: 25,
      LKnee: 22,
      RKnee: 22
    },
    weights: {
      LShoulder: 1.2,
      RShoulder: 1.2,
      LElbow: 0.9,
      RElbow: 0.9,
      LHip: 1.4,
      RHip: 1.4,
      LKnee: 1.2,
      RKnee: 1.2
    },
    checklist: [
      {
        id: "straight_arms",
        text: "Arms long & elbows straight",
        primaryJoints: ["LElbow", "RElbow"]
      },
      {
        id: "hips_high",
        text: "Hips pressed high (sharp V)",
        primaryJoints: ["LHip", "RHip"]
      },
      {
        id: "straight_legs",
        text: "Legs lengthened",
        primaryJoints: ["LKnee", "RKnee"]
      },
      {
        id: "shoulder_line",
        text: "Torso aligned with arms",
        primaryJoints: ["LShoulder", "RShoulder"]
      }
    ]
  },
  {
    id: 4,
    name: "Chair Pose (Utkaṭāsana)",
    sanskritName: "Utkaṭāsana",
    image: "/poses/chair.svg",
    desc: "Bend knees deeply as if sitting back into an imaginary chair while sweeping arms strongly overhead along ears.",
    cameraTip: "Position camera at a slight side angle (45°) so knee depth and arm elevation are visible.",
    category: "Core & Thigh Power",
    viewOrientation: "diagonal",
    benefits: [
      "Strengthens ankles, calves, thighs, and spine",
      "Stretches shoulders and thorax",
      "Stimulates abdominal organs, diaphragm, and heart"
    ],
    steps: [
      "Stand tall with big toes touching and heels slightly apart.",
      "Inhale and raise arms overhead perpendicular to the floor, palms facing inward.",
      "Exhale and bend knees, sitting hips back as if settling into a low chair.",
      "Keep inner thighs parallel, weight in the heels, and chest lifted proudly."
    ],
    commonMistakes: [
      "Allowing knees to shoot past the toes (shift hips further back)",
      "Arching lower back excessively (tuck tailbone slightly)",
      "Dropping arms forward below head height"
    ],
    angles: {
      LShoulder: 160,
      RShoulder: 160,
      LElbow: 170,
      RElbow: 170,
      LHip: 100,
      RHip: 100,
      LKnee: 100,
      RKnee: 100
    },
    tolerances: {
      LShoulder: 25,
      RShoulder: 25,
      LElbow: 25,
      RElbow: 25,
      LHip: 25,
      RHip: 25,
      LKnee: 22,
      RKnee: 22
    },
    weights: {
      LShoulder: 1.1,
      RShoulder: 1.1,
      LElbow: 0.8,
      RElbow: 0.8,
      LHip: 1.4,
      RHip: 1.4,
      LKnee: 1.6,
      RKnee: 1.6
    },
    checklist: [
      {
        id: "knees_bent",
        text: "Knees deep at ~100°",
        primaryJoints: ["LKnee", "RKnee"]
      },
      {
        id: "hips_back",
        text: "Hips flexed back into seat",
        primaryJoints: ["LHip", "RHip"]
      },
      {
        id: "arms_overhead",
        text: "Arms reaching high overhead",
        primaryJoints: ["LShoulder", "RShoulder"]
      },
      {
        id: "elbows_straight",
        text: "Arms straight",
        primaryJoints: ["LElbow", "RElbow"]
      }
    ]
  },
  {
    id: 5,
    name: "Cobra Pose (Bhujaṅgāsana)",
    sanskritName: "Bhujaṅgāsana",
    image: "/poses/cobra.svg",
    desc: "Lie prone on your mat and use your spinal muscles to gently curl the chest upwards with elbows tucked close.",
    cameraTip: "Place camera low on a table or book stack about 2–3 meters away, viewing your side profile.",
    category: "Spinal Extension",
    viewOrientation: "side",
    benefits: [
      "Strengthens the entire spine and posterior chain",
      "Opens the chest, heart center, lungs, and shoulders",
      "Invigorates the nervous system and relieves stress"
    ],
    steps: [
      "Lie face down on the mat with tops of feet pressing into the floor.",
      "Place palms under shoulders with fingers pointing forward and elbows tucked in.",
      "Press pubic bone and thighs firmly down into the mat.",
      "Inhale and lift chest off the mat using back muscles; keep only light weight in hands."
    ],
    commonMistakes: [
      "Crunching into the lower back by pushing too hard with arms",
      "Flaring elbows wide away from ribs",
      "Craning the neck backwards instead of keeping the cervical spine long"
    ],
    angles: {
      LShoulder: 60,
      RShoulder: 60,
      LElbow: 135,
      RElbow: 135,
      LHip: 155,
      RHip: 155,
      LKnee: 175,
      RKnee: 175
    },
    tolerances: {
      LShoulder: 25,
      RShoulder: 25,
      LElbow: 30,
      RElbow: 30,
      LHip: 25,
      RHip: 25,
      LKnee: 20,
      RKnee: 20
    },
    weights: {
      LShoulder: 1.2,
      RShoulder: 1.2,
      LElbow: 1.1,
      RElbow: 1.1,
      LHip: 1.4,
      RHip: 1.4,
      LKnee: 0.9,
      RKnee: 0.9
    },
    checklist: [
      {
        id: "chest_lifted",
        text: "Chest arched upwards",
        primaryJoints: ["LShoulder", "RShoulder"]
      },
      {
        id: "elbows_tucked",
        text: "Elbows bent close to body",
        primaryJoints: ["LElbow", "RElbow"]
      },
      {
        id: "legs_grounded",
        text: "Pelvis and legs grounded",
        primaryJoints: ["LHip", "RHip"]
      },
      {
        id: "knees_straight",
        text: "Legs extended back",
        primaryJoints: ["LKnee", "RKnee"]
      }
    ]
  }
];
