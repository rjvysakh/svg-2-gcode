# svg_gcode

"svg_gcode" is an npm package that converts SVG file inputs into G-code text. It is a modified version of the open source repository "gcodercnc2d5" by drandrewthomas, with additional modifications in jQuery. 

v1.0.8 
Removed fs, now works with ReactJS.

## Installation

You can install the package using npm:

```
npm install svg_gcode
```

## Usage

Here's an example of how to use "svg_gcode" to convert an SVG file into G-code text:

```javascript
const svgGcode = require('svg_gcode');

// Read SVG file contents from a file or a string
var svgString = '<svg width="2480" height="3508" viewBox="0 0 2480 3508" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="2.5" width="2475" height="3503" stroke="black" stroke-width="5"/></svg>';

// Convert SVG to G-code

svgGcode(svgString, {
  laserIntensity: 22,
  laserOnSpeed: 400,
  laserOffSpeed: 259,
}).then((gcode)=> console.log(gcode));

```

The `svgGcode()` function takes an SVG file input as a string and returns the G-code text as a string. You can pass the SVG file input as a string or read it from a file.

## Credits

This package is based on the open source repository "gcodercnc2d5" by drandrewthomas. You can find the original repository here: https://github.com/drandrewthomas/gcodercnc2d5.

## License

This package is licensed under the MIT License. See the LICENSE file for details.