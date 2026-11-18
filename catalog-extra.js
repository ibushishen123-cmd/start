const dimensions = (width, length) => `${width} cm x ${length} m`;

function entries(family, name, description, rows) {
  return rows.map(([code, size, perCarton, perBox, packaging], i) => ({
    id: `${family}-${i}`, family, name, description, code, size,
    image: `assets/catalog-${family}.jpg`,
    perCarton: perCarton ? String(perCarton) : '', perBox, packaging: packaging || '',
  }));
}

const cohesiveSizes = [2.5,5,7.5,10,15];
const cohesiveBoxes = [48,24,16,12,8];
const cohesive = (prefix, suffix = '') => cohesiveSizes.map((width,i) =>
  [`${prefix}${i+1}${suffix}`,dimensions(width,4.5),cohesiveBoxes[i]*12,cohesiveBoxes[i]]);
const elastic = [5,7.5,10,15].map((width,i) =>
  ['',dimensions(width,4.5),[720,480,360,240][i],12]);
const elasticCodes = elastic.map(([, ...row],i) =>
  [`EB11${['050','075','100','150'][i]}0450`, ...row]);
const straps = ['ST010250910','ST010380910','ST010500910','ST010251370','ST010381370','ST010501370']
  .map((code,i) => [code,dimensions([2.5,3.8,5][i%3],i<3?9.1:13.7),[288,192,144][i%3],[48,32,24][i%3]]);
const dressing = prefix => [5,7.5,10,15,20,30].map((width,i) =>
  [`${prefix}${['050','075','100','150','200','300'][i]}1000`,dimensions(width,10),[150,125,80,50,50,25][i],1]);
const castingSizes = [5,7.5,10,12.5,15];

export const extraCatalog = [
  ...entries('cotton-cohesive','Cotton Cohesive Bandage','Cotton fabric and natural latex.',cohesive('SA010')),
  ...entries('vet-wrap','Vet Wrap','Printed veterinary cohesive bandage. Contains natural latex.',cohesive('SA020','LP')),
  ...entries('glitter','Glitter Cohesive Bandage','Self-adhering bandage with a glitter finish.',cohesive('SA020','GL').slice(1)),
  ...entries('premium','Premium Cohesive Bandage','Cotton yarn and nonwoven fabric.',[
    ['SA04015P',dimensions(3.8,4.5),384,32],['SA040157P',dimensions(4,4.5),288,24],
    ['SA040236P',dimensions(6,4.5),192,16],['SA0404P',dimensions(10,4.5),144,12],['SA0405P',dimensions(15,4.5),96,8],
  ]),
  ...entries('double-layer','Double-Layer Nonwoven Cohesive Bandage','Double-layer, self-adhering nonwoven fabric.',cohesive('SA030','D')),
  ...entries('heavy-cohesive','Heavy Cohesive Bandage','Embossed, double-layer self-adhering bandage.',cohesive('SA030','H')),
  ...entries('pbt','PBT Cohesive Bandage','Soft, breathable PBT bandage.',[4,5,6,8,10,12].map((width,i) =>
    [`SA100${i+1}L`,dimensions(width,4.5),[288,288,192,192,144,144][i],[24,24,16,16,12,12][i]])),
  ...entries('foam-cohesive','Foam Cohesive Bandage','Soft cohesive foam.',[
    ['PW0801',dimensions(6,2),144,24],['PW0802',dimensions(6,5),72,12],
  ]),
  ...entries('first-aid','First Aid Cohesive Bandage','Elastic bandage with dressing pad.',[5,7.5,10,15].map((width,i) =>
    [`SADP0${i+2}`,`${dimensions(width,2)} (pad ${[10,10,10,15][i]} x ${width} cm)`])),
  ...entries('traditional-cooling','Traditional Elastic Cooling Bandage','Elastic cooling bandage.',[
    ['CB1002',dimensions(7.5,3.2),120,10],['CB1003',dimensions(10,3.2),96,8],
  ]),
  ...entries('heavy-elastic','Heavy Elastic Adhesive Bandage','Latex-free elastic adhesive bandage.',[
    ['HE010250450',dimensions(2.5,4.5),null,48],['HE010500450',dimensions(5,4.5),288,24],
    ['HE010750450',dimensions(7.5,4.5),192,12],['HE011000450',dimensions(10,4.5),144,12],
  ]),
  ...entries('light-elastic','Light Elastic Adhesive Bandage','Elastic cotton with single-sided adhesive.',[2.5,3.8,5,7.5,10].map((width,i) =>
    [`LE01${['025','038','050','075','100'][i]}0450`,dimensions(width,4.5),[540,360,270,180,126][i],[90,60,45,30,21][i]])),
  ...entries('nylon','Nylon Kinesiology Tape','Nylon and spandex with acrylic adhesive.',[2.5,3.8,5,7.5,10].map((width,i) =>
    ['',dimensions(width,5),[240,160,120,80,60][i],[12,8,6,4,2][i],'Individual shrink wrap'])),
  ...entries('cotton-strapping','Cotton Sport Strapping Tape','Cotton fabric with pressure-sensitive adhesive.',straps),
  ...entries('rigid-strapping','Rigid Strapping Tape','Rayon cotton and zinc oxide adhesive.',straps),
  ...entries('under-wrap','Under Wrap Foam Tape','Polyurethane foam.',[
    ['PW080602000',dimensions(6,20),196,null,'Shrink wrap'],['PW080702700',dimensions(7,27),196,null,'Shrink wrap'],
  ]),
  ...entries('hockey-stick','Polyester Hockey Stick Tape','Adhesive hockey equipment tape.',[
    ['HT010251000',dimensions(2.5,10),200,null,'2 rolls/shrink pack'],['HT010252500',dimensions(2.5,25),96,null,'1 roll/shrink pack'],
  ]),
  ...entries('hockey-sock','Clear Hockey Sock Tape','Clear PVC hockey tape.',[['HTQT0252500',dimensions(2.5,25),100]]),
  ...entries('crepe','Crepe Elastic Bandage','Cotton or spandex. Metal or elastic clips.',elasticCodes),
  ...entries('plain-elastic','Plain Elastic Bandage','Cotton or spandex. Metal or elastic clips.',elasticCodes),
  ...entries('cotton-elastic','Cotton High Elastic Bandage','Cotton, polyester and spandex.',elastic),
  ...entries('pop','POP Bandage','Gauze and gypsum powder.',[5,7.5,10,15,20].map((width,i) =>
    [`PB10${['050','075','100','150','200'][i]}0450`,dimensions(width,2.7),[240,240,120,120,60][i]])),
  ...entries('ortho-padding','Orthopaedic Padding Bandage','Cotton, synthetic or blended undercast padding.',[5,7.5,10,15,20].map((width,i) =>
    [`PBQT${['050','075','100','150','200'][i]}0450`,dimensions(width,2.7),[720,480,360,240,180][i]])),
  ...entries('casting','Orthopedic Casting Tape','Fiberglass or polyester fabric.',castingSizes.map((width,i) =>
    [`PB09${['050','075','100','125','150'][i]}0360`,dimensions(width,3.6),[120,120,90,90,90][i],10])),
  ...entries('medical-tape','Medical Tape','Medical adhesive tape.',[1.25,2.5,5,7.5,10,1.25,2.5,5,7.5,10].map((width,i) =>
    ['',`${width} cm x ${i<5?'5 yd (4.5 m)':'10 yd (9.1 m)'}`,[720,360,180,144,108,720,360,180,108,72][i],[24,12,6,6,6][i%5]])),
  ...entries('foot-foam','Foam Foot Care Sticker','PE foam adhesive roll.',[2.5,5,7.5,10].map((width,i) =>
    ['',dimensions(width,5),[36,36,null,36][i],[12,6,4,3][i]])),
  ...entries('nonwoven-fix','Nonwoven Adhesive Sheet FIX','Nonwoven dressing fixation tape.',dressing('PW02')),
  ...entries('transparent','Transparent Wound Dressing Tape','Transparent protective dressing tape.',dressing('PWPU')),
  ...entries('cotton-gauze','Cotton Wool Roll Combined with Gauze','Bleached cotton wool with gauze.',[
    ['',dimensions(30,3.5),25],['',dimensions(45,2.3),25],
  ]),
];
