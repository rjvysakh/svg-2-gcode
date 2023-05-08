
const { DOMParser } = require('xmldom');
const fs = require('fs');

var mainversion=1,subversion=6;
var svgin,filename,fext,gcode="";
var torad=Math.PI/180;
var transforms=[];
var commands=[];
var lastx,lasty;
var cutterwidth,cutterheight,cutteraspect,cnccanvas;
var arcdist=0.2; // Distance between points on arcs
var xmin,xmax,ymin,ymax,originx=0,originy=0,sc=0,textelfound;
var defaultspeed=50,defaultfeed=200,defaultgroup=0;
var originpos=0,defaultcut=1,defaultpasses=1,defaultbottomprofile=0;
var safez=4,points=[],handles=[],passmode=0;
var loaded=false,stopchangedevents=false,cncmode=1,selhand=-1;
var maxspeed=1000; // GRBL spindle speed maximum value
var g0feed=2000; // Move speed when not cutting/engraving
var projecturl=""; // For when a sample file is loaded
var tempsample,grblmode=0;

var svgcommands=['<svg','<g','</svg','</g','<path','<rect','<circle','<ellipse','<line','<polygon','<polyline','<text','<image'];

var bottomprofilelist=["Flat all along","Straight down-up","Straight up-down","Sine down-up","Sine up-down","Straight just down","Straight just up",
                       "Sine just down","Sine just up","Trapezoid 80% flat"];
var origintexts=["Bottom left","Top left","Bottom right","Top right","Middle"];



/// function calling

fetchSVG('shirt_shop_std_back.svg');


/// import

function fetchSVG(file_name){
  filename = file_name

  fs.readFile("./inputs/"+filename, 'utf-8', (err, data) => {
    if (err) {
      console.error(`Error reading file: ${err.message}`);
    } else {
      // `data` contains the contents of the SVG file as a string
      console.log(`SVG file contents:\n${data}`);

      // You can process the SVG data here as needed
      loadfile(data)

    }
  });  
}


function loadfile(svgString)
{
  projecturl="";
  selhand=-1;
  commands=[];
  transforms=[];
  svgin = svgString
  // svgin=e.target.result;
  cleansvg();
  parsesvg();
  getbounds();
  moveto(0,0);
  makepathsforselection();
  cutterwidth=(xmax-xmin);
  cutterheight=(ymax-ymin);
  cutteraspect=cutterwidth/cutterheight;
//   $('#defaultprefsbox').show();
  loaded=true;
  // layoutapp();
  // drawtocanvas("svgcanvas");
  // setsvgtexts();
  if(textelfound===true) console.log("textel found")
  generategcode(cutterwidth, //width
     cutterheight, //height
     0, //input_grblmode (0 -1000)
     0, //input safez
      259, // movespeed (200) /// F2000  movement when laser off
      0 //passmode (path by path)
      )
}


function getbounds()
{
  var c,d,x,y,pts;
  xmin=999999999;
  xmax=-999999999;
  ymin=999999999;
  ymax=-999999999;
  for(c=0;c<commands.length;c++)
  {
    if(commands[c][0]==='L')
    {
      pts=commands[c][1];
      for(d=0;d<pts.length;d++)
      {
        x=pts[d][0];
        y=pts[d][1];
        if(x<xmin) xmin=x;
        if(x>xmax) xmax=x;
        if(y<ymin) ymin=y;
        if(y>ymax) ymax=y;
      }
    }
  }
}


function moveto(mx,my)
{
  var c,d,x,y,dx,dy,pts;
  dx=xmin-mx;
  dy=ymin-my;
  for(c=0;c<commands.length;c++)
  {
    if(commands[c][0]==='L')
    {
      pts=commands[c][1];
      for(d=0;d<pts.length;d++)
      {
        x=pts[d][0];
        y=pts[d][1];
        pts[d][0]=x-dx;
        pts[d][1]=y-dy;
      }
    }
  }
  xmin=mx;
  ymin=my;
  xmax=xmax-dx;
  ymax=ymax-dy;
}

function makepathsforselection()
{
  var c;
  for(c=0;c<commands.length;c++)
  {
    commands[c][10]=makeselectionpath(commands[c][1]);
  }
}

function mag(a,b)
{
  return Math.sqrt((a*a)+(b*b));
}

function makeselectionpath(pts)
{
  var c,d,slen,px,py,dx,dy,sx,sy,ex,ey,np,tpts=[],adist=1;
  if(pts.length<2) return pts;
  tpts.push(pts[0]);
  for(c=1;c<pts.length;c++)
  {
    ex=pts[c][0];
    ey=pts[c][1];
    sx=pts[c-1][0];
    sy=pts[c-1][1];
    slen=mag(sx-ex,sy-ey);
    if(slen<adist) tpts.push([ex,ey]);
    else
    {
      np=Math.floor(slen/adist);
      dx=(ex-sx)/np;
      dy=(ey-sy)/np;
      for(d=0;d<=np;d++)
      {
        px=sx+(d*dx);
        py=sy+(d*dy);
        tpts.push([px,py]);
      }
    }
  }
  tpts.push(pts[pts.length-1]);
  return tpts;
}


///svg cleaning and parsing
function cleansvg() {
    var c, d, sp, ep, ch, brs, i, inst, lines = [],
      svg = '';
    svgin = svgin.replace(/[\n\r]+/g, '');
    svgin = svgin.trim();
    svgin = svgin.replace(/     /g, " ");
    svgin = svgin.replace(/    /g, " ");
    svgin = svgin.replace(/   /g, " ");
    svgin = svgin.replace(/  /g, " ");
    svgin = svgin.replace(/<  /g, "<");
    svgin = svgin.replace(/  >/g, ">");
    svgin = svgin.replace(/ >/g, ">");
    svgin = svgin.replace(/defs \//g, "defs/");
    svgin = svgin.replace(/>/g, ">\n");
    if (svgin.includes("<defs")) {
      brs = 1;
      i = 1;
      sp = svgin.indexOf("<defs");
      if (svgin.includes("</defs>")) {
        ep = svgin.indexOf("</defs>") + 6;
      } else {
        while ((sp + i) < svgin.length) {
          ch = svgin.charAt(sp + i);
          if (ch === '<') brs++;
          if (ch === '>') brs--;
          if (brs === 0) {
            ep = sp + i;
            break;
          }
          i++;
        }
      }
      svgin = svgin.substring(0, sp - 1) + svgin.substring(ep + 1, svgin.length - 1);
    }
    lines = svgin.split("\n");
    for (c = 0; c < lines.length; c++) {
      inst = false;
      for (d = 0; d < svgcommands.length; d++) {
        if (lines[c].includes(svgcommands[d])) inst = true;
      }
      if (inst === true) svg += lines[c] + "\n";
    }
    svgin = svg;
    
}
// for parsing svg, extract elements from the svg and transforming
function parsesvg() {
    var c, svgchild, parser, xmldoc, svg;
    textelfound = false;
    svg = svgin.replace('<?xml version="1.0" encoding="utf-8"?>', "");
       parser = new DOMParser();
      xmldoc = parser.parseFromString(svg, "image/svg+xml");
      if (xmldoc.hasChildNodes()) {
        svgchild = xmldoc.childNodes;
        for (c = 0; c < svgchild.length; c++) {
          if (svgchild[c].nodeName !== "defs") {
            parseelement(svgchild[c]);
          }
        }
      }
}
  
/// parse each element for getting circle polygon shape and applying corresponding functions
  function parseelement(el) {
    var c, t, elchild, name, type, cnodes, stroke, strokewidth;
    name = el.nodeName;
    type = el.nodeType;
    cnodes = el.hasChildNodes();
    if (cnodes === true) {
      if (name === "g") {
        t = el.getAttribute('transform');
        stroke = el.getAttribute('stroke');
        strokewidth = el.getAttribute('stroke-width');
        if (t !== null) {
          transforms.push(gettransform(t));
        }
      }
      elchild = el.childNodes;
      for (c = 0; c < elchild.length; c++) parseelement(elchild[c]);
      if (name === "g" && t !== null) transforms.pop();
    }
    if (name === 'path') {
      var path = el.getAttribute('d');
      if (path !== null) {
        path = path.trim();
        path = cleanpath(path);
        var paths = splitcompoundpath(path);
        for (c = 0; c < paths.length; c++) {
          if (c === 0) dopathelement(el, paths[c], false);
          else dopathelement(el, paths[c], true);
        }
      }
    } else if (name === 'rect') dorectelement(el);
    else if (name === 'circle') docircleelement(el);
    else if (name === 'ellipse') doellipseelement(el);
    else if (name === 'line') dolineelement(el);
    else if (name === 'polygon') dopolygonelement(el);
    else if (name === 'polyline') dopolylineelement(el);
    else if (name === 'image') doimageelement(el);
    else if (name === 'text') dotextelement(el);
    else dounknownelement(el);
  }

// split compounded path into seperate paths
  function splitcompoundpath(p) {
    var c, path = p,
      paths;
    path = path.replace(/M/g, "*M");
    path = path.replace(/m/g, "*m");
    if (path[0] === '*') path = path.substring(1);
    paths = path.split("*");
    for (c = 0; c < paths.length; c++) paths[c] = paths[c].replace(/,\s*$/, "");
    return paths;
  }


  function dounknownelement(el) {}

  /// clean path to  extract as  pure character
  function cleanpath(p) {
    var path = p;
    console.log("path",path)
    path = path.replace(/M/g, " M");
    path = path.replace(/L/g, " L");
    path = path.replace(/H/g, " H");
    path = path.replace(/V/g, " V");
    path = path.replace(/C/g, " C");
    path = path.replace(/S/g, " S");
    path = path.replace(/Q/g, " Q");
    path = path.replace(/T/g, " T");
    path = path.replace(/A/g, " A");
    path = path.replace(/m/g, " m");
    path = path.replace(/l/g, " l");
    path = path.replace(/h/g, " h");
    path = path.replace(/v/g, " v");
    path = path.replace(/c/g, " c");
    path = path.replace(/s/g, " s");
    path = path.replace(/q/g, " q");
    path = path.replace(/t/g, " t");
    path = path.replace(/a/g, " a");
    path = path.replace(/\t/g, '');
    path = path.replace(/  +/g, ' ');
    path = path.replace(/M /g, "M");
    path = path.replace(/L /g, "L");
    path = path.replace(/H /g, "H");
    path = path.replace(/V /g, "V");
    path = path.replace(/C /g, "C");
    path = path.replace(/S /g, "S");
    path = path.replace(/Q /g, "Q");
    path = path.replace(/T /g, "T");
    path = path.replace(/A /g, "A");
    path = path.replace(/M/g, "M,");
    path = path.replace(/L/g, "L,");
    path = path.replace(/H/g, "H,");
    path = path.replace(/V/g, "V,");
    path = path.replace(/C/g, "C,");
    path = path.replace(/S/g, "S,");
    path = path.replace(/Q/g, "Q,");
    path = path.replace(/T/g, "T,");
    path = path.replace(/A/g, "A,");
    path = path.replace(/m /g, "m");
    path = path.replace(/l /g, "l");
    path = path.replace(/h /g, "h");
    path = path.replace(/v /g, "v");
    path = path.replace(/c /g, "c");
    path = path.replace(/s /g, "s");
    path = path.replace(/q /g, "q");
    path = path.replace(/t /g, "t");
    path = path.replace(/a /g, "a");
    path = path.replace(/m/g, "m,");
    path = path.replace(/l/g, "l,");
    path = path.replace(/h/g, "h,");
    path = path.replace(/v/g, "v,");
    path = path.replace(/c/g, "c,");
    path = path.replace(/s/g, "s,");
    path = path.replace(/q/g, "q,");
    path = path.replace(/t/g, "t,");
    path = path.replace(/a/g, "a,");
    path = path.replace(/ /g, ",");
    if (path[0] === ',') path = path.substring(1);
    console.log(path)
    return path;
  }
  
  /// parse the float value
  //TODO - FIX THE ISSUE  WITH UNDEFINED VALTXT CALLING INCLUDES
  function parseMyFloat(valtxt) {
    var r = null;
    console.log(valtxt)
    // console.log(valtxt===undefined)
    // console.log(valtxt===NaN)
    console.log(typeof valtxt)

    // if (!valtxt || (valtxt === null) || (valtxt === undefined) || (valtxt=== NaN)) {
    //   r=0;

    // }else{
      console.log("inside")
      console.log(valtxt)

      
      if (valtxt &&  (valtxt.includes("e") || valtxt.includes("E"))) {
        r = parseFloat(valtxt.split("e")[0]);
      }else {
        r = parseFloat(valtxt);

      }
      console.log(r)

    return r;
  }
 

  ///generate path element 
  function dopathelement(el, p, startlast) {
    //M = moveto
    //L = lineto
    //H = horizontal lineto
    //V = vertical lineto
    //C = curveto
    //S = smooth curveto
    //Q = quadratic Bezier curve
    //T = smooth quadratic Bezier curveto
    //A = elliptical arc
    //Z = closepath
    var closed = 0;
    var path = p;
    var ind, x, y, xy, ex, ey, x2, y2, x3, y3, x4, y4, mx = 0,
      my = 0,
      pline;
    var ret, en = 1,
      absmode = true,
      lastcmd = '',
      firstm = true;
    if (startlast === false) {
      lastx = 0;
      lasty = 0;
    }
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    if (path.length < 2) return;
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    pline = path.split(',');
    ind = 0;
    points = [];
    while (ind < pline.length) {
      absmode = true;
      lastcmd = pline[ind];
      if (pline[ind] === "m" || pline[ind] === "l" || pline[ind] === "h" ||
        pline[ind] === "v" || pline[ind] === "c" || pline[ind] === "s" ||
        pline[ind] === "q" || pline[ind] === "t" || pline[ind] === "a") {
        pline[ind] = pline[ind].toUpperCase();
        absmode = false;
      }
      if (pline[ind] === 'M') {
        if (absmode === true) {
          x = parseMyFloat(pline[ind + 1]);
          y = parseMyFloat(pline[ind + 2]);
        } else {
          x = lastx + parseMyFloat(pline[ind + 1]);
          y = lasty + parseMyFloat(pline[ind + 2]);
        }
        xy = dotransforms(x, y, tmat);
        if (firstm === true) {
          firstm = false;
          points.push([xy[0], xy[1]]);
          mx = xy[0];
          my = xy[1];
          lastx = x;
          lasty = y;
          ind += 3;
        } else ind = pline.length; // Ignor compound path elements after first one
      } else if (pline[ind] === 'L') {
        if (absmode === true) {
          x = parseMyFloat(pline[ind + 1]);
          y = parseMyFloat(pline[ind + 2]);
        } else {
          x = lastx + parseMyFloat(pline[ind + 1]);
          y = lasty + parseMyFloat(pline[ind + 2]);
        }
        xy = dotransforms(x, y, tmat);
        points.push([xy[0], xy[1]]);
        lastx = x;
        lasty = y;
        ind += 3;
      } else if (pline[ind] === 'H') {
        if (absmode === true) x = parseMyFloat(pline[ind + 1]);
        else x = lastx + parseMyFloat(pline[ind + 1]);
        y = lasty;
        xy = dotransforms(x, y, tmat);
        points.push([xy[0], xy[1]]);
        lastx = x;
        lasty = y;
        ind += 2;
      } else if (pline[ind] === 'V') {
        x = lastx;
        if (absmode === true) y = parseMyFloat(pline[ind + 1]);
        else y = lasty + parseMyFloat(pline[ind + 1]);
        xy = dotransforms(x, y, tmat);
        points.push([xy[0], xy[1]]);
        lastx = x;
        lasty = y;
        ind += 2;
      } else if (pline[ind] === 'A') {
        var rx = parseMyFloat(pline[ind + 1]);
        var ry = parseMyFloat(pline[ind + 2]);
        var xrot = parseMyFloat(pline[ind + 3]);
        var aflag = parseInt(pline[ind + 4]);
        var sflag = parseInt(pline[ind + 5]);
        if (absmode === true) {
          ex = parseMyFloat(pline[ind + 6]);
          ey = parseMyFloat(pline[ind + 7]);
        } else {
          ex = lastx + parseMyFloat(pline[ind + 6]);
          ey = lasty + parseMyFloat(pline[ind + 7]);
        }
        ret = drawpatharc(lastx, lasty, rx, ry, xrot, aflag, sflag, ex, ey, tmat)
        lastx = ret[0];
        lasty = ret[1];
        ind += 8;
      } else if (pline[ind] === 'Q') {
        if (absmode === true) {
          x2 = parseMyFloat(pline[ind + 1]);
          y2 = parseMyFloat(pline[ind + 2]);
          x3 = parseMyFloat(pline[ind + 3]);
          y3 = parseMyFloat(pline[ind + 4]);
        } else {
          x2 = lastx + parseMyFloat(pline[ind + 1]);
          y2 = lasty + parseMyFloat(pline[ind + 2]);
          x3 = lastx + parseMyFloat(pline[ind + 3]);
          y3 = lasty + parseMyFloat(pline[ind + 4]);
        }
        ret = drawquadraticcurve(lastx, lasty, x2, y2, x3, y3, tmat);
        lastx = ret[0];
        lasty = ret[1];
        ind += 5;
      } else if (pline[ind] === 'C') {
        if (absmode === true) {
          x2 = parseMyFloat(pline[ind + 1]);
          y2 = parseMyFloat(pline[ind + 2]);
          x3 = parseMyFloat(pline[ind + 3]);
          y3 = parseMyFloat(pline[ind + 4]);
          x4 = parseMyFloat(pline[ind + 5]);
          y4 = parseMyFloat(pline[ind + 6]);
        } else {
          x2 = lastx + parseMyFloat(pline[ind + 1]);
          y2 = lasty + parseMyFloat(pline[ind + 2]);
          x3 = lastx + parseMyFloat(pline[ind + 3]);
          y3 = lasty + parseMyFloat(pline[ind + 4]);
          x4 = lastx + parseMyFloat(pline[ind + 5]);
          y4 = lasty + parseMyFloat(pline[ind + 6]);
        }
        ret = drawcubicbezier(lastx, lasty, x2, y2, x3, y3, x4, y4, tmat);
        lastx = ret[0];
        lasty = ret[1];
        ind += 7;
      } else if (pline[ind] === 'S') {
        ind += 5;
      } else if (pline[ind] === 'T') {
        ind += 3;
      } else if (pline[ind] === 'Z' || pline[ind] === 'z') {
        points.push([mx, my]);
        ind++;
        closed = 1;
      } else {
        console.log("Path unknown command : '" + pline[ind] + "' (" + pline[ind].charCodeAt(0) + ")");
        console.log(path.length);
        console.log(path);
        ind++;
      }
      if (ind > 0 && ind < pline.length) {
        if (!("MmLlHhVvCcSsQqTtAaZz".includes(pline[ind]))) {
          if (lastcmd === 'M') lastcmd = 'L';
          if (lastcmd === 'm') lastcmd = 'l';
          ind--;
          pline[ind] = lastcmd;
        }
      }
    }
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  
  ///function for rect component
  function dorectelement(el) {
    var closed = 1;
    var xy, en = 1;
    var cl = el.getAttribute('class');
    if(cl === "BoundingBox") return;
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    var x = parseMyFloat(el.getAttribute('x'));
    var y = parseMyFloat(el.getAttribute('y'));
    var w = parseMyFloat(el.getAttribute('width'));
    var h = parseMyFloat(el.getAttribute('height'));
    var rx = parseMyFloat(el.getAttribute('rx'));
    var ry = parseMyFloat(el.getAttribute('ry'));
    if (rx === null && ry !== null) rx = ry;
    if (rx !== null && ry === null) ry = rx;
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    points = [];
    if (rx === null || ry === null || isNaN(rx) || isNaN(ry)) {
      xy = dotransforms(x, y, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x + w, y, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x + w, y + h, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x, y + h, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x, y, tmat);
      points.push([xy[0], xy[1]]);
    } else {
      drawarc(x + rx, y + ry, rx, ry, 270, 90, 1, tmat);
      xy = dotransforms(x + rx, y, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x + w - rx, y, tmat);
      points.push([xy[0], xy[1]]);
      drawarc(x + w - rx, y + ry, rx, ry, 0, 90, 1, tmat);
      xy = dotransforms(x + w, y + ry, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x + w, y + h - ry, tmat);
      points.push([xy[0], xy[1]]);
      drawarc(x + w - rx, y + h - ry, rx, ry, 90, 90, 1, tmat);
      xy = dotransforms(x + w - rx, y + h, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x + rx, y + h, tmat);
      points.push([xy[0], xy[1]]);
      drawarc(x + rx, y + h - ry, rx, ry, 180, 90, 1, tmat);
      xy = dotransforms(x, y + h - ry, tmat);
      points.push([xy[0], xy[1]]);
      xy = dotransforms(x, y + ry, tmat);
      points.push([xy[0], xy[1]]);
    }
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  /// function for circle element
  function docircleelement(el) {
    var closed = 1;
    var en = 1;
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    var x = parseMyFloat(el.getAttribute('cx'));
    var y = parseMyFloat(el.getAttribute('cy'));
    var r = parseMyFloat(el.getAttribute('r'));
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    points = [];
    drawarc(x, y, r, r, 0, 360, 1, tmat);
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  
  /// function for ellipse element
  function doellipseelement(el) {
    var closed = 1;
    var en = 1;
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    var x = parseMyFloat(el.getAttribute('cx'));
    var y = parseMyFloat(el.getAttribute('cy'));
    var rx = parseMyFloat(el.getAttribute('rx'));
    var ry = parseMyFloat(el.getAttribute('ry'));
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    points = [];
    drawarc(x, y, rx, ry, 0, 360, 1, tmat);
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  // function for line  element
  function dolineelement(el) {
    var closed = 0;
    var xy, en = 1;
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    var x1 = parseMyFloat(el.getAttribute('x1'));
    var y1 = parseMyFloat(el.getAttribute('y1'));
    var x2 = parseMyFloat(el.getAttribute('x2'));
    var y2 = parseMyFloat(el.getAttribute('y2'));
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    points = [];
    xy = dotransforms(x1, y1, tmat);
    points.push([xy[0], xy[1]]);
    xy = dotransforms(x2, y2, tmat);
    points.push([xy[0], xy[1]]);
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  // function for polygon element
  function dopolygonelement(el) {
    var closed = 1;
    var x, y, xy, sx, sy, c, pline, en = 1;
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    var pts = el.getAttribute('points');
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    pline = pts.split(',');
    points = [];
    for (c = 0; c < pline.length; c += 2) {
      x = parseMyFloat(pline[c]);
      y = parseMyFloat(pline[c + 1]);
      xy = dotransforms(x, y, tmat);
      if (c === 0) {
        points.push([xy[0], xy[1]]);
        sx = xy[0];
        sy = xy[1];
      } else points.push([xy[0], xy[1]]);
    }
    points.push([sx, sy]);
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  /// function for polyline element
  function dopolylineelement(el) {
    var closed = 0;
    var x, y, xy, c, pline, en = 1;
    var stroke = el.getAttribute('stroke');
    if (stroke === "none") en = 0;
    var pts = el.getAttribute('points');
    var strokewidth = parseInt(el.getAttribute('stroke-width'));
    var trans = el.getAttribute('transform');
    var tmat = gettransform(trans);
    pline = pts.split(',');
    points = [];
    for (c = 0; c < pline.length; c += 2) {
      x = parseMyFloat(pline[c]);
      y = parseMyFloat(pline[c + 1]);
      xy = dotransforms(x, y, tmat);
      points.push([xy[0], xy[1]]);
    }
    if (points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1])
      closed = 1;
    commands.push(['L', points, -1, -1, -1, -1, en, -1, 0, -1, 0, closed]);
  }
  // image element function
  function doimageelement(el) {
    var xy, en = 1;
    var x = parseMyFloat(el.getAttribute('x'));
    var y = parseMyFloat(el.getAttribute('y'));
    var w = parseMyFloat(el.getAttribute('width'));
    var h = parseMyFloat(el.getAttribute('height'));
    var h = parseMyFloat(el.getAttribute('xlink:href'));
    console.log("IMAGE");
  }
  /// text element 
  function dotextelement(el) {
    textelfound = true;
    console.log("TEXT");
  }
  

  ///function to draw an arc
  function drawarc(cx, cy, rx, ry, dsa, sw, dir, tmat) {
    var cang, ang, mx, my, xy, lastx, lasty;
    var sa = (dsa / 180) * Math.PI;
    var sweep = Math.abs((sw / 180) * Math.PI);
    var astep = sweep / 10000;
    for (cang = 0; cang <= sweep; cang += astep) {
      ang = sa + (cang * dir);
      if (ang < 0) ang += (2 * Math.PI);
      if (ang > (2 * Math.PI)) ang -= (2 * Math.PI);
      mx = cx + (rx * Math.sin(ang));
      my = cy - (ry * Math.cos(ang));
      if (cang === 0 || dist(lastx, lasty, mx, my) > arcdist || cang >= sweep) {
        xy = dotransforms(mx, my, tmat);
        points.push([xy[0], xy[1]]);
        lastx = mx;
        lasty = my;
      }
    }
    return [lastx, lasty];
  }
  /// function to draw quadratic curve
  function drawquadraticcurve(x1, y1, x2, y2, x3, y3, tmat) {
    var c, t, x, y, xy, lastx = 0,
      lasty = 0;
    var numtries = 1000;
    for (c = 0; c <= numtries; c++) {
      t = c / numtries;
      x = Math.pow(1 - t, 2) * x1 + 2 * (1 - t) * t * x2 + Math.pow(t, 2) * x3;
      y = Math.pow(1 - t, 2) * y1 + 2 * (1 - t) * t * y2 + Math.pow(t, 2) * y3;
      if (c === 0 || dist(lastx, lasty, x, y) > arcdist || c === (numtries - 1)) {
        xy = dotransforms(x, y, tmat);
        points.push([xy[0], xy[1]]);
        lastx = x;
        lasty = y;
      }
    }
    return [lastx, lasty];
  }
  /// function to draw path arc
  function drawpatharc(sx, sy, ttrx, ttry, txrot, aflag, sflag, ex, ey, tmat) {
    var sweepsteps = 10000;
    var cang, ang, mx, my, xy, rxy, lastx = sx,
      lasty = sy;
    var sa, ea, dir;
    var rx = ttrx;
    var ry = ttry;
    var xrot = (txrot / 180) * Math.PI;
    // *** Arc centre based on https://github.com/canvg/canvg/blob/master/src/canvg.js (13Aug18) ***
    var currpx = Math.cos(xrot) * (sx - ex) / 2.0 + Math.sin(xrot) * (sy - ey) / 2.0;
    var currpy = -Math.sin(xrot) * (sx - ex) / 2.0 + Math.cos(xrot) * (sy - ey) / 2.0;
    var l = Math.pow(currpx, 2) / Math.pow(rx, 2) + Math.pow(currpy, 2) / Math.pow(ry, 2);
    if (l > 1) {
      rx *= Math.sqrt(l);
      ry *= Math.sqrt(l);
    }
    var s = (aflag == sflag ? -1 : 1) * Math.sqrt(
      ((Math.pow(rx, 2) * Math.pow(ry, 2)) - (Math.pow(rx, 2) * Math.pow(currpy, 2)) - (Math.pow(ry, 2) * Math.pow(currpx, 2))) /
      (Math.pow(rx, 2) * Math.pow(currpy, 2) + Math.pow(ry, 2) * Math.pow(currpx, 2))
    );
    if (isNaN(s)) s = 0;
    var cppx = s * rx * currpy / ry;
    var cppy = s * -ry * currpx / rx;
    var cx = (sx + ex) / 2.0 + Math.cos(xrot) * cppx - Math.sin(xrot) * cppy;
    var cy = (sy + ey) / 2.0 + Math.sin(xrot) * cppx + Math.cos(xrot) * cppy;
    var m = function(v) {
      return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
    }
    var r = function(u, v) {
      return (u[0] * v[0] + u[1] * v[1]) / (m(u) * m(v))
    }
    var a = function(u, v) {
      return (u[0] * v[1] < u[1] * v[0] ? -1 : 1) * Math.acos(r(u, v));
    }
    sa = a([1, 0], [(currpx - cppx) / rx, (currpy - cppy) / ry]);
    var u = [(currpx - cppx) / rx, (currpy - cppy) / ry];
    var v = [(-currpx - cppx) / rx, (-currpy - cppy) / ry];
    var sweep = a(u, v);
    if (r(u, v) <= -1) sweep = Math.PI;
    if (r(u, v) >= 1) sweep = 0;
    // *** End of arc centre stuff ***
    if (sflag == 1) dir = 1;
    else dir = -1;
    var astep = sweep / sweepsteps;
    for (cang = 0; cang <= sweepsteps; cang++) {
      ang = sa + (cang * Math.abs(astep) * dir);
      if (ang < 0) ang += (2 * Math.PI);
      if (ang > (2 * Math.PI)) ang -= (2 * Math.PI);
      mx = rx * Math.cos(ang);
      my = ry * Math.sin(ang);
      if (xrot !== 0 && xrot !== (2 * Math.PI)) {
        rxy = rotatepoint(mx, my, xrot);
        mx = rxy[0];
        my = rxy[1];
      }
      mx += cx;
      my += cy;
      if (dist(lastx, lasty, mx, my) > arcdist || cang === 0 || cang === sweepsteps) {
        xy = dotransforms(mx, my, tmat);
        points.push([xy[0], xy[1]]);
        lastx = mx;
        lasty = my;
      }
    }
    return [lastx, lasty];
  }
/// function to rotate point
  function rotatepoint(x,y,a)
{
  var sa=getangle(x,y);
  var m=mag(x,y);
  var ex=m*Math.sin(sa-a);
  var ey=m*Math.cos(sa-a);
  return [ex,ey];
}

/// get angle of the element
function getangle(a,b)
{
  if((a==0) && (b==0)) return 0;
  var sang=Math.atan(a/b);
  if(sang<0) sang*=(-1);
  if((a>=0) && (b>=0)) return sang;
  if((a>=0) && (b<=0)) return Math.PI-sang;
  if((a<=0) && (b<=0)) return Math.PI+sang;
  if((a<=0) && (b>=0)) return (2*Math.PI)-sang;
  return 0;
}
/// distance between two points by eucludean distance
function dist(sx,sy,ex,ey)
{
  return Math.sqrt(Math.pow(ex-sx,2)+Math.pow(ey-sy,2));
}
///function to draw cubic bezier
function drawcubicbezier(ax, ay, bx, by, cx, cy, dx, dy, tmat) {
    // a is start and d is end. b and c are control points.
    var c, t, x, y, b0, b1, b2, b3, xy, lastx = ax,
      lasty = ay;
    for (c = 0; c <= 1000; c++) {
      t = c / 1000;
      b0 = Math.pow(1 - t, 3);
      b1 = 3 * t * Math.pow(1 - t, 2);
      b2 = 3 * Math.pow(t, 2) * (1 - t);
      b3 = Math.pow(t, 3);
      x = (b0 * ax) + (b1 * bx) + (b2 * cx) + (b3 * dx);
      y = (b0 * ay) + (b1 * by) + (b2 * cy) + (b3 * dy);
      if (dist(lastx, lasty, x, y) > arcdist || c === 0 || c === 1000) {
        xy = dotransforms(x, y, tmat);
        points.push([xy[0], xy[1]]);
        lastx = x;
        lasty = y;
      }
    }
    return [lastx, lasty];
}
/// function to get transform
function gettransform(trans) {
    var ttxt, pos, ret, m, tt, tr, ts, t1, t2, t3, t4, t5, t6;
    var mat=[1,0,0,1,0,0];
    var t = [0, 0],
      s = [1, 1],
      r = [0, 0, 0];
    if (trans !== null) {
      pos = trans.search("matrix");
      if (pos != -1) {
        trans = trans.replace(/\s/g, ''); // Remove all white space
        ttxt = trans.substring(pos + 7);
        pos = ttxt.search('\\)');
        ttxt = ttxt.substring(0, pos);
        m = ttxt.split(' ').join(',').split(',');
        if (m.length === 6) {
          t1 = parseFloat(m[0]);
          t2 = parseFloat(m[1]);
          t3 = parseFloat(m[2]);
          t4 = parseFloat(m[3]);
          t5 = parseFloat(m[4]);
          t6 = parseFloat(m[5]);
          if (!isNaN(t1) && t1 !== null && !isNaN(t2) && t2 !== null &&
              !isNaN(t3) && t3 !== null && !isNaN(t4) && t4 !== null &&
              !isNaN(t5) && t5 !== null && !isNaN(t6) && t6 !== null)
            mat = [t1,t2,t3,t4,t5,t6];
        }
      } else // Either matrix or separate operations
      {
        pos = trans.search("translate");
        if (pos != -1) {
          ttxt = trans.substring(pos + 10);
          pos = ttxt.search('\\)');
          ttxt = ttxt.substring(0, pos);
          tt = ttxt.split(' ').join(',').split(',');
          if (tt.length === 2) {
            t1 = parseFloat(tt[0]);
            t2 = parseFloat(tt[1]);
            if (!isNaN(t1) && t1 !== null && !isNaN(t2) && t2 !== null)
              t = [t[0], t[1]];
          }
        }
        pos = trans.search("scale");
        if (pos != -1) {
          ttxt = trans.substring(pos + 6);
          pos = ttxt.search('\\)');
          ttxt = ttxt.substring(0, pos);
          ts = ttxt.split(' ').join(',').split(',');
          if (ts.length === 1) {
            t1 = parseFloat(ts);
            if (!isNaN(t1) && t1 !== null)
              s = [t1, t1];
          }
          if (ts.length === 2) {
            t1 = parseFloat(ts[0]);
            t2 = parseFloat(ts[1]);
            if (!isNaN(t1) && t1 !== null && !isNaN(t2) && t2 !== null)
              s = [t1, t2];
          }
        }
        pos = trans.search("rotate");
        if (pos != -1) {
          ttxt = trans.substring(pos + 7);
          pos = ttxt.search('\\)');
          ttxt = ttxt.substring(0, pos);
          tr = ttxt.split(' ').join(',').split(',');
          if (tr.length === 1) {
            t1 = parseFloat(tr);
            if (!isNaN(t1) && t1 !== null)
              r = [t1, 0, 0];
          }
          if (tr.length === 3) {
            t1 = parseFloat(tr[0]);
            t2 = parseFloat(tr[1]);
            t3 = parseFloat(tr[2]);
            if (!isNaN(t1) && t1 !== null && !isNaN(t2) && t2 !== null && !isNaN(t3) && t3 !== null)
              r = [t1, t2, t3];
          }
        }
        mat=[s[0] * Math.cos(r[0]*torad), s[1] * Math.sin(r[0]*torad), -s[0] * Math.sin(r[0]*torad), s[1] * Math.cos(r[0]*torad),
             (-r[1] * Math.cos(r[0]*torad) + r[2] * Math.sin(r[0]*torad) + r[1]) * s[0] + t[0],
             (-r[1] * Math.sin(r[0]*torad) - r[2] * Math.cos(r[0]*torad) + r[2]) * s[1] + t[1]];
      }
    }
    return mat;
  }
  /// do transform
  function dotransforms(x, y, t) {
    var c, pt;
    pt = applytransform(x, y, t);
    if (transforms.length > 0) {
      for (c = transforms.length - 1; c >= 0; c--) {
        pt = applytransform(pt[0], pt[1], transforms[c]);
      }
    }
    return pt;
  }
  /// apply transform
  function applytransform(x, y, t) {
    var px, py;
    px = t[0] * x + t[2] * y + t[4];
    py = t[1] * x + t[3] * y + t[5];
    return [px, py];
  }




/// export  functions 

///generate gcode wrapper
function generategcode(width, height, input_grblmode,input_safez, movespeed, input_passmode)
{
  var w,h,sz,gm,fr,validated=false;
  w=parseFloat(width);
  h=parseFloat(height);
  sz=parseFloat(input_safez);
  gm=input_grblmode; // 0 for 0-1000, 1 for 0-255
  grblmode=gm;
  fr=(movespeed+1)*50;
  g0feed=fr;
  passmode=input_passmode; // 0 for path by path,1 for pass by pass
  if(w>0 && h>0 && sz>=0 && sz<=100 && !isNaN(w) && !isNaN(h) && !isNaN(sz))
    validated=true;
  if(validated===false)
  {
    console.log('error: not validated')
  }
  if(gm===0) maxspeed=1000;
  else       maxspeed=255;
  cutterwidth=w;
  cutterheight=h;
  safez=sz;
  downloadcncfile();
//   savesettingslocally();
}

function downloadcncfile()
{
  var fname= filename.split(".")[0] +".nc";
  makecnctext();

  fs.writeFile("./outputs/"+fname, gcode, 'utf-8', (err) => {
    if (err) {
      console.error(`Error writing file: ${err.message}`);
    } else {
      console.log(`File '${fname}' saved successfully.`);
    }
  });
}

function makecnctext()
{
  // makecnccommentheader();
  makecncstartgcode();
  makecnctext_pathbypath();
  // if(passmode===0) makecnctext_pathbypath();
  // if(passmode===1) makecnctext_passbypass();
  makecncendgcode();
}
/// header contents not needed
function makecnccommentheader()
{
  var dt,ds,h,m;
  var mths=["January","February","March","April","May","June","July","August","September","October","November","December"]
  dt=new Date();
  h=dt.getHours();
  if(h<10) h="0"+h;
  else h=""+h;
  m=dt.getMinutes();
  if(m<10) m="0"+m;
  else m=""+m;
  ds=""+dt.getDate()+" "+mths[dt.getMonth()]+" "+dt.getFullYear()+" ("+h+":"+m+")";
  gcode="";
  gcode+="; GRBL CNC GCode file\r\n";
  gcode+="; Generated date: "+ds+"\r\n";
  gcode+="; Generated by: GCoderCNC (https://github.com/drandrewthomas/gcodercnc2d5)\r\n";
  gcode+="; Input file: "+filename+"\r\n";
  if(cncmode==0) gcode+="; Cutting mode: Router\r\n";
  if(cncmode==1) gcode+="; Cutting mode: LASER\r\n";
  gcode+="; Origin position: "+origintexts[originpos]+"\r\n";
  gcode+="; Plan dimensions: "+cutterwidth+"mm wide (X-axis) x "+cutterheight+"mm high (Y-axis)\r\n";
  gcode+="; Maximum feed rate: "+getmaxfeedrate()+"mm/min cutting and "+g0feed+"mm/min moving\r\n";
  if(cncmode===0) gcode+="; Maximum cut depth: "+getmaxcutdepth()+"mm\r\n";
  if(cncmode==0) gcode+="; Safe Z offset: "+safez+"mm\r\n";
  gcode+="; GRBL spindle speed maximum: "+maxspeed+"\r\n";
  if(passmode===0) gcode+="; Pass mode: Path by path\r\n";
  if(passmode===1) gcode+="; Pass mode: Pass by pass\r\n";
  gcode+="\r\n";
}
/// max feedrate
function getmaxfeedrate()
{
  var c,fr=defaultfeed;
  for(c=0;c<commands.length;c++)
    if(commands[c][0]==='L' && commands[c][6]===1)
      if(commands[c][8]!==0)
        if(commands[c][4]>fr) fr=commands[c][4];
  return fr;
}
//max cut depth
function getmaxcutdepth()
{
  var c,mc=defaultcut;
  if(cncmode===1) return 0;
  for(c=0;c<commands.length;c++)
    if(commands[c][0]==='L' && commands[c][6]===1)
      if(commands[c][8]!==0)
        if(commands[c][2]>mc) mc=commands[c][2];
  return mc;
}
/// start gcode
function makecncstartgcode()
{
  gcode+="; Getting the CNC set up\r\n";
  gcode+="G21 ; Set units to mm\r\n"; 
  gcode+="G17 ; Select XY plane\r\n";
  gcode+="G90 ; Set absolute coordinate mode\r\n";
  if(cncmode===0)
  {
    gcode+="G0 X0 Y0 Z0 F"+g0feed+" S0 ; Move to work origin\r\n";
    gcode+="M3 ; Start spindle motor clockwise\r\n";
  }
  else
  {
    gcode+="M5 ; Ensure LASER is turned off\r\n";
    gcode+="G0 X0 Y0 F"+g0feed+" S0 ; Move to work origin\r\n";
  }
  gcode+="G91 ; Set relative coordinate mode\r\n";
  gcode+="\r\n";
  gcode+="; Ready to start cutting/engraving\r\n";
  gcode+="\r\n";
}
/// getting  default values
function getdefaults()
{
  defaultfeed=400; ///F600 values for laser on
  defaultspeed=22; //S1000
  defaultcut=1;
  defaultpasses=1;
  defaultgroup=0;
  defaultbottomprofile=0;
}

/// cnctext path by path
function makecnctext_pathbypath()
{
  var c,d,ct=0,pass,group,x,y,z,tx,ty,lastx,lasty,lastz,pts;
  var cfeed,cspeed,cpasses,ccut,cgroup;
  getdefaults();
  var maxpasses=defaultpasses;
  for(c=0;c<commands.length;c++)
    if(commands[c][8]===1)
      if(commands[c][3]>maxpasses)
        maxpasses=commands[c][3];
  var sfx=cutterwidth/(xmax-xmin);
  var sfy=cutterheight/(ymax-ymin);
  switch(originpos)
  {
    case 0: originx=0; originy=0; break; // Bottom left
    case 1: originx=0; originy=cutterheight; break; // Top left
    case 2: originx=cutterwidth; originy=0; break; // Bottom right
    case 3: originx=cutterwidth; originy=cutterheight; break; // Top right
    case 4: originx=cutterwidth/2; originy=cutterheight/2; break; // Middle
  }
  lastx=0; lasty=0;
  for(group=0;group<5;group++)
  {
    for(c=0;c<commands.length;c++)
    {
      if(commands[c][0]==='L' && commands[c][6]===1)
      {
        if(commands[c][8]===0)
        {
          ccut=defaultcut;
          cpasses=defaultpasses;
          cfeed=defaultfeed;
          cspeed=Math.floor((defaultspeed/100)*maxspeed);
          cgroup=defaultgroup;
        }
        else
        {
          ccut=commands[c][2];
          cpasses=commands[c][3];
          cfeed=commands[c][4];
          cspeed=Math.floor((commands[c][5]/100)*maxspeed);
          cgroup=commands[c][7];
        }
        if(cgroup===group)
        {
          lastz=0;
          gcode+="\r\n";
          for(pass=0;pass<cpasses;pass++)
          {
            if(cncmode===0) ct=((pass+1)/cpasses)*ccut;
            pts=maketoolpath(c,ct,ccut,sfx,sfy,cutterheight);
            tx=pts[0][0];
            ty=pts[0][1];
            x=(tx-originx)-lastx;
            y=(ty-originy)-lasty;
            z=pts[0][2]-lastz;
            lastx=tx-originx;
            lasty=ty-originy;
            lastz=pts[0][2];
            gcode+="G0 X"+x.toFixed(3)+" Y"+y.toFixed(3)+" F"+g0feed+" S"+cspeed+"\r\n";
            gcode+="G0 F"+cfeed+" S"+cspeed+"\r\n";
            if(cncmode===0  && (pass===0 || commands[c][11]===0))
              gcode+="G0 Z-"+safez+" ; Move down to top of cut\r\n";
            if(cncmode===0)
              gcode+="G0 Z"+z.toFixed(3)+"\r\n";
            if(cncmode===1  && (pass===0 || commands[c][11]===0))
              gcode+="M3 I; Turn on the LASER\r\n";
            for(d=1;d<pts.length;d++)
            {
              tx=pts[d][0];
              ty=pts[d][1];
              x=(tx-originx)-lastx;
              y=(ty-originy)-lasty;
              z=pts[d][2]-lastz;
              lastx=tx-originx;
              lasty=ty-originy;
              lastz=pts[d][2];
              if(cncmode===0) gcode+="G1 X"+x.toFixed(3)+" Y"+y.toFixed(3)+" Z"+z.toFixed(3)+"\r\n";
              if(cncmode===1) gcode+="G1 X"+x.toFixed(3)+" Y"+y.toFixed(3)+"\r\n";
            }
            if(cncmode===0 && commands[c][11]!==1)
            {
              lastz=0;
              gcode+="G90 ; Set absolute coordinate mode\r\n";
              gcode+="G0 Z0 ; Move up to Safe Z height\r\n";
              gcode+="G91 ; Set relative coordinate mode\r\n";
            }
            if(cncmode===1 && commands[c][11]!==1) gcode+="M5 ; Turn off the LASER\r\n";
          }
          if(cncmode===0 && commands[c][11]===1)
          {
            lastz=0;
            gcode+="G90 ; Set absolute coordinate mode\r\n";
            gcode+="G0 Z0 ; Move up to Safe Z height\r\n";
            gcode+="G91 ; Set relative coordinate mode\r\n";
          }
          if(cncmode===1 && commands[c][11]===1) gcode+="M5 ; Turn off the LASER\r\n";
        }
      }
    }
  }
}

function maketoolpath(path,cutdepth,totaldepth,sfx,sfy,cutterheight)
{
  var c,pts,lastz,profile,plen,cumlen=0,lenprop=0,tmp;
  pts=commands[path][1];
  // Scale to finished dimensions
  pts=scaletoolpath(pts,sfx,sfy,cutterheight);
  // Simplify to sensible segment lengths
  pts=simplifytoolpath(pts,arcdist);
  // If not a flat bottom profile increase the number of points
  if(commands[path][9]!==-1) profile=commands[path][9];
  else profile=defaultbottomprofile;
  if(profile!==0) pts=pathtoarcdistance(pts);
  // Calculate the path  length
  plen=pathlength(pts);
  // Calculate depth based on bottom profile type
  for(c=0;c<pts.length;c++)
  {
    if(c>0)
    {
      cumlen+=mag(pts[c][0]-pts[c-1][0],pts[c][1]-pts[c-1][1]);
      lenprop=cumlen/plen;
    }
    switch(profile)
    {
      case 0: // Flat all along
              pts[c][2]=totaldepth;
              break;
      case 1: // Straight down-up
              if(lenprop<0.5) pts[c][2]=totaldepth*(lenprop*2);
              else            pts[c][2]=totaldepth*((1-lenprop)*2);
              break;
      case 2: // Straight up-down
              if(lenprop<0.5) pts[c][2]=totaldepth-totaldepth*(lenprop*2);
              else            pts[c][2]=totaldepth-totaldepth*((1-lenprop)*2);
              break;
      case 3: // Sine down-up
              pts[c][2]=totaldepth*Math.sin(lenprop*Math.PI);
              break;
      case 4: // Sine up-down
              pts[c][2]=totaldepth-totaldepth*Math.sin(lenprop*Math.PI);
              break;
      case 5: // Straight just down
              pts[c][2]=totaldepth*lenprop;
              break;
      case 6: // Straight just up
              pts[c][2]=totaldepth-totaldepth*lenprop;
              break;
      case 7: // Sine just down
              pts[c][2]=totaldepth*Math.sin(lenprop*Math.PI/2);
              break;
      case 8: // Sine just up
              pts[c][2]=totaldepth-totaldepth*Math.sin(lenprop*Math.PI/2);
              break;
      case 9: // Trapezoid 80% flat
              if(lenprop<0.1)      pts[c][2]=totaldepth*(lenprop*10);
              else if(lenprop>0.9) pts[c][2]=totaldepth*((1-lenprop)*10);
              else                 pts[c][2]=totaldepth;
              break;
    }
  }
  for(c=0;c<pts.length;c++) if(pts[c][2]>cutdepth) pts[c][2]=cutdepth;
  for(c=0;c<pts.length;c++) pts[c][2]*=-1;
  return pts;
}

function pathlength(path)
{
  var c,plen=0;
  if(path.length>1)
  {
    for(c=1;c<path.length;c++)
    {
      plen+=mag(path[c][0]-path[c-1][0],path[c][1]-path[c-1][1]);
    }
  }
  return plen;
}

function scaletoolpath(pts,sfx,sfy,cutterheight)
{
  var c,x,y,newpts=[];
  for(c=0;c<pts.length;c++)
  {
    x=pts[c][0]*sfx;
    y=(cutterheight-(pts[c][1]*sfy));
    newpts.push([x,y,0]);
  }
  return newpts;
}

function simplifytoolpath(pts,ad)
{
  var c,x,y,ox,oy,sx=pts[0][0],sy=pts[0][1],npts=[],bd,fd;
  for(c=0;c<pts.length;c++)
  {
    x=pts[c][0];
    y=pts[c][1];
    if(c===0 || c===(pts.length-1)) npts.push([x,y,0]);
    else
    {
      bd=Math.sqrt(Math.pow(x-sx,2)+Math.pow(y-sy,2));
      ox=pts[c+1][0];
      oy=pts[c+1][1];
      fd=Math.sqrt(Math.pow(x-ox,2)+Math.pow(y-oy,2));
      if(bd>=ad || fd>=(10*ad))
      {
        npts.push([x,y,0]);
        sx=x;
        sy=y;
      }
    }
  }
  return npts;
}



function makecncendgcode()
{
  gcode+="\r\n";
  gcode+="; End of cutting - finishing off\r\n"
  gcode+="G90 ; Set absolute coordinate mode\r\n";
  gcode+="G0 X0 Y0 F13000; Move to work origin\r\n";
  gcode+="M5 ; Ensure the spindle motor or LASER is turned off\r\n";
  gcode+="M2 ; End the program\r\n";
}





  
  
