/* ═══════════════════════════════════════════════════════════
   Shared punch list definition — Rosemary Villas at Chenal
   Transcribed from the printed CM punch list.

   Loaded by BOTH punchlist.html (the phone walkthrough) and
   punch-dashboard.html (the central view), so the two can never
   drift apart — reword a check once and both sides follow.

   Saved results are stored against  <roomId>.<catIndex>.<itemIndex>,
   so do NOT reorder or delete items in an existing room without
   migrating saved data. Appending to the END of a category is safe.
   ═══════════════════════════════════════════════════════════ */
/* ── Who may sign off on a fix ──
   A punch item closes out in two stages: someone marks it fixed, then
   someone verifies it. By default anyone on the job can do either — both
   names and times are recorded, and the report shows plainly when the same
   person did both.

   Set this to true to allow only hub admins to verify. It is a real control
   (it keys off the signed-in hub role) but it also makes every sign-off wait
   on an admin, so it is off unless that trade is wanted. */
const PUNCH_CONFIG = { verifyRequiresAdmin: false };

const ROOMS = [
  { id:'guest-bed', name:'Guest Bedroom', emoji:'🛏️', cats:[
    { name:'Electrical & Lighting', items:[
      'Verify all recessed lights (cans) are operational and consistent in color',
      'Verify all light switches are functioning properly',
      'Test all electrical outlets for proper function',
      'Test ceiling fan operation at all speeds' ]},
    { name:'Doors, Windows & Hardware', items:[
      'Inspect door hardware, including knobs and door stops',
      'Confirm at least one window is operable',
      'Verify window blinds function correctly' ]},
    { name:'Paint, Trim & Finish', items:[
      'Inspect trim for paint cracks or deficiencies',
      'Inspect walls for bowing or irregularities',
      'Verify all wall paint touch-ups are complete' ]}
  ]},

  { id:'guest-bath', name:'Guest Bathroom', emoji:'🛁', cats:[
    { name:'Electrical & Ventilation', items:[
      'Verify all recessed lights (cans) are consistent in color',
      'Test exhaust fan for proper operation' ]},
    { name:'Plumbing', items:[
      'Test all plumbing fixtures for proper operation',
      'Verify hot water is functional at all taps',
      'Verify toilet is functioning properly' ]},
    { name:'Cabinets & Hardware', items:[
      'Verify all cabinets are fully painted and finished',
      'Confirm all cabinets operate properly (open/close smoothly)',
      'Inspect and verify cabinet hardware is installed correctly',
      'Verify toilet paper holder is installed securely',
      'Remove clips from mirrors' ]},
    { name:'Tile & Finish', items:[
      'Inspect trim for required paint touch-ups',
      'Inspect tile for missing or incomplete grout',
      'Verify all tile transitions are properly installed' ]}
  ]},

  { id:'foyer', name:'Foyer', emoji:'🚪', cats:[
    { name:'Electrical & Lighting', items:[
      'Verify all recessed lights (cans) are operational and consistent in color',
      'Test hanging light fixture for proper operation',
      'Verify all light switches are functioning properly' ]},
    { name:'Paint & Finish', items:[
      'Inspect for any paint touch-ups needed' ]}
  ]},

  { id:'flex', name:'Flex Room', emoji:'🧩', cats:[
    { name:'Electrical & Lighting', items:[
      'Verify all recessed lights (4 cans) are operational and consistent in color' ]},
    { name:'Doors & Mechanical', items:[
      'Test ceiling fan for proper operation',
      'Test sliding door for proper operation',
      'Inspect sliding door for paint or finish touch-ups' ]},
    { name:'Paint & Finish', items:[
      'Inspect trim for paint touch-ups',
      'Inspect walls for bowing or irregularities',
      'Verify all wall paint touch-ups are complete' ]}
  ]},

  { id:'kitchen', name:'Kitchen', emoji:'🍽️', cats:[
    { name:'Electrical & Lighting', items:[
      'Set backsplash lights (far right, 1 click left) and verify operation',
      'Verify all lights are operational and consistent in color',
      'Verify all light switches function correctly' ]},
    { name:'Appliances', items:[
      'Set correct time on refrigerator',
      'Set correct time on dishwasher',
      'Set correct time on microwave',
      'Set correct time on oven',
      'Remove all packaging from appliances',
      'Verify dishwasher runs properly',
      'Verify refrigerator is cooling properly',
      'Verify vent hood operates properly',
      'Verify all appliances are operational' ]},
    { name:'Cabinets & Countertops', items:[
      'Check all cabinets operate correctly',
      'Check cabinet alignment (doors even)',
      'Verify cabinet hardware is installed and tight',
      'Check cabinets for paint touch-ups',
      'Inspect countertops for damage or glue residue' ]},
    { name:'Plumbing & Gas', items:[
      'Verify sink operates properly (hot/cold)',
      'Check for leaks under sink',
      'Verify garbage disposal works properly',
      'Verify gas stove operates properly',
      'Check for gas leaks' ]},
    { name:'Tile, Flooring & Finish', items:[
      'Check backsplash for missing grout or gaps',
      'Inspect flooring for damage' ]}
  ]},

  { id:'laundry', name:'Laundry Room', emoji:'🧺', cats:[
    { name:'Cabinets & Finish', items:[
      'Inspect all cabinets for required paint touch-ups',
      'Confirm all cabinets operate properly (open/close smoothly)' ]},
    { name:'HVAC & Plumbing', items:[
      'Verify HVAC vent is installed and unobstructed',
      'Test sink for proper plumbing function' ]},
    { name:'Doors & Lighting', items:[
      'Verify pocket door operates smoothly and latches properly',
      'Confirm recessed lights (cans) are consistent in color' ]}
  ]},

  { id:'living', name:'Living Room', emoji:'🛋️', cats:[
    { name:'Electrical & Lighting', items:[
      'Verify all recessed lights (cans) are operational and consistent in color',
      'Test ceiling fan for proper operation',
      'Test hanging light fixture for proper operation',
      'Test all electrical outlets for proper function',
      'Verify TV outlet/connection is operational',
      'Test floor outlet for proper function' ]},
    { name:'Fireplace & Doors', items:[
      'Verify fireplace is installed and functioning properly',
      'Verify double wide doors operate smoothly and latch properly' ]}
  ]},

  { id:'master-bed', name:'Master Bedroom', emoji:'🛏️', cats:[
    { name:'Electrical & Lighting', items:[
      'Verify all recessed lights (4 cans) are operational and consistent in color',
      'Test ceiling fan for proper operation',
      'Test all electrical outlets for proper function' ]},
    { name:'Doors, Windows & Hardware', items:[
      'Verify windows open properly',
      'Check blinds for proper operation',
      'Inspect and verify all door hardware is installed correctly' ]},
    { name:'Paint, Trim & Finish', items:[
      'Inspect walls for bowing or irregularities',
      'Verify all paint touch-ups are complete',
      'Inspect installation of quarter round trim',
      'Verify all cabinetry is fully painted and finished' ]}
  ]},

  { id:'master-bath', name:'Master Bathroom', emoji:'🚿', cats:[
    { name:'Electrical & Ventilation', items:[
      'Verify all recessed lights (cans) are operational and consistent in color',
      'Test exhaust fan for proper operation' ]},
    { name:'Plumbing & Fixtures', items:[
      'Verify all plumbing fixtures and hardware are installed',
      'Test all plumbing fixtures for proper water flow and operation',
      'Verify toilet is functioning properly' ]},
    { name:'Shower, Glass & Mirrors', items:[
      'Confirm glass shower door operates smoothly and seals properly',
      'Confirm mirrors are installed securely and aligned properly' ]},
    { name:'Tile & Finish', items:[
      'Inspect tile installation and grout for completeness and quality',
      'Inspect countertops for residue or installation debris' ]},
    { name:'Hardware', items:[
      'Verify toilet paper holder is installed properly' ]}
  ]},

  { id:'master-closet', name:'Master Closet', emoji:'👔', cats:[
    { name:'Hardware & Shelving', items:[
      'Verify all closet hardware is installed',
      'Verify seasonal rods are installed',
      'Verify all hardware is secure and aligned properly' ]},
    { name:'Paint & Finish', items:[
      'Inspect for required paint touch-ups',
      'Verify installation of quarter round trim' ]}
  ]}
];

/* Stable key for every checklist item: room.category.index */
function itemKey(roomIdx, catIdx, itemIdx){
  return ROOMS[roomIdx].id + '.' + catIdx + '.' + itemIdx;
}
const TOTAL_ITEMS = ROOMS.reduce((n,r)=> n + r.cats.reduce((m,c)=> m + c.items.length, 0), 0);
