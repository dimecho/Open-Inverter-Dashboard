var odo;

document.addEventListener("DOMContentLoaded", function(event) {

    loadJSON("views/dashboard-1.json",
        function(data) {
            //console.log(data);

            var front = document.getElementsByClassName("front");
            var table = document.createElement("table");
            var tr = document.createElement("tr");

            for (i in data.dashboard)
            {
                console.log(data.dashboard[i].renderTo);

                var td = document.createElement("td");
                var canvas = document.createElement("canvas");
                //canvas.style.cssText = "vertical-align: top";
                canvas.setAttribute("id", data.dashboard[i].renderTo);
                td.appendChild(canvas);
                tr.appendChild(td);
            }
            table.appendChild(tr);
            
            //var odometer = CANRead("distance");
     
            if(data.odometer)
            {
                var tr = document.createElement("tr");
                var td = document.createElement("td");
                td.colSpan = data.dashboard.length;

                var canvas = document.createElement("canvas");
                canvas.id = "odometer";
                canvas.height = 32;
                canvas.width = 200;

                td.appendChild(canvas);
                tr.appendChild(td);
                table.appendChild(tr);
            }
            
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.colSpan = data.dashboard.length;
            
            for (i in data.alerts)
            {
                //console.log(data.alerts[i].svg);
                var span = document.createElement("span");
                var img = document.createElement("img");
                img.classList.add("svg-inject");
                img.classList.add("svg-grey");
                img.style.cssText = "width:" + getWidth()/12 + "px;height:" + getWidth()/12 + "px";
                img.src = "img/" + data.alerts[i].id;

                SVGInjector(img);

                span.appendChild(img);
                td.appendChild(span);
            }
            tr.appendChild(td);
            table.appendChild(tr);
            front[0].appendChild(table);

            for (i in data.dashboard)
            {
                data.dashboard[i].width = getWidth() * data.dashboard[i].width;
                data.dashboard[i].height = getHeight() * data.dashboard[i].height;
                var gauge = new RadialGauge(data.dashboard[i]).draw();
            }

            if(data.odometer)
            {
                display = new SegmentDisplay("odometer",data.odometer);
                display.draw();
                display.setValue(data.odometer.count);
                //updateOdometer(data.odometer.count);
            }

            for (i in data.sounds)
            {
                if(data.sounds[i].run)
                {
                    xhr.open("GET", "sounds/" + data.sounds[i].id, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = function(e){
                        window.addEventListener("keydown", createPitchStep(data.sounds[i].pitchStep))
                        window.addEventListener("keyup", createPitchStep(-data.sounds[i].pitchStep))
                        engineStart(this.response);
                    };
                    xhr.send();

                    break;
                }
            }
        },
        function(xhr) { console.error(xhr); }
    );
});

function loadJSON(path, success, error)
{
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function()
    {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                if (success)
                    success(JSON.parse(xhr.responseText));
            } else {
                if (error)
                    error(xhr);
            }
        }
    };
    xhr.open("GET", path, true);
    xhr.send();
};

function getWidth() {
  return Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.documentElement.clientWidth
  );
};

function getHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  );
};

function CANRead(value) {

   var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
           if (xmlhttp.status == 200) {
               return xmlhttp.responseText;
           }else{
                return xmlhttp.status;
           }
        }
    };

    xmlhttp.open("GET", "can.php", true);
    xmlhttp.send();
};

function updateOdometer(n) {
    n += 0.01
    odo.setValue(n);
    setTimeout(function(){updateOdometer(n)}, 80);
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var dLat = (lat2 - lat1).toRad();
  var dLon = (lon2 - lon1).toRad();
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  var d = R * c;
  return d;
};

Number.prototype.toRad = function() {
  return this * Math.PI / 180;
};