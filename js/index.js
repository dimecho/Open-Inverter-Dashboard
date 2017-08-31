var odo;

window.addEventListener('load', function()
{
	
    loadAJAX("views/1.json",
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
                
                var svg = document.createElement("svg");
                svg.classList.add("svg-inject");
                svg.classList.add("svg-grey");
                svg.style.width = getWidth()/12 + "px";
                svg.style.height = getWidth()/12 + "px";
                svg.setAttribute("data-src", "img/" + data.alerts[i].id);
                //svg.setAttribute("data-fallback", "img/" + data.alerts[i].id + ".png");
                td.appendChild(svg);

                new SVGInjector().inject(svg);
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

			if(data.sounds)
			{
				xhr.open("GET", "sounds/" + data.sounds[i].id, true);
				xhr.responseType = "arraybuffer";
				xhr.onload = function(e){
					window.addEventListener("keydown", createPitchStep(data.sounds[i].pitchStep))
					window.addEventListener("keyup", createPitchStep(-data.sounds[i].pitchStep))
					engineStart(this.response);
				};
				xhr.send();
			}
        },
        function(xhr) { console.error(xhr); }
    );
	
	
	streamAJAX("serial.php?stream=udc");

	document.gauges.forEach(function(gauge)
	{
		setInterval(function() { gauge.value = 20; }, 200);
		/*
		setInterval(function()
		{
			switch (gauge.options.renderTo.id)
			{
			case "speed":
				gauge.value = "111";
				break;
			case "rpm":
				gauge.value = data_val2;
				break;
			}
		}, 200);
		*/
	});
});

function streamAJAX(path)
{
	var xhr = new XMLHttpRequest();
	var _alert = document.getElementsByClassName("alert");
	xhr.onreadystatechange = function()
	{
		//console.log("State change: "+ xhr.readyState);
		if(xhr.readyState == 3) {
			var newData = xhr.response.substr(xhr.seenBytes);
			if(newData !== "Unknown command sequence")
			{
				console.log(newData);
			}
			xhr.seenBytes = xhr.responseText.length;
			//console.log("seenBytes: " +xhr.seenBytes);
			_alert.style.display = "none";
		}else if (xhr.readyState == 4) {
			//console.log("Complete");
			//console.log(xhr.responseText);
			_alert.innerHTML = "Connection Lost";
			_alert.style.display = "block";
		}
	};
	xhr.addEventListener("error", function(e) {
	  console.log("error: " +e);
	});
	
	xhr.open('GET', path, true);
	xhr.send();
};

function loadAJAX(path, success, error)
{
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function()
    {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                if (success)
					if(path.indexOf(".json") !== -1) {
						success(JSON.parse(xhr.responseText));
					}else{
						success(xhr.responseText);
					}
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