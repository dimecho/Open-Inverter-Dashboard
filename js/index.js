var json = "";
var json_file = "views/1.json";
var blink_emergency;
var blink_battery;
var odometer_count;

var dashboardVisible = [];
var dashboardHidden = [];

//window.addEventListener('load', function()
document.addEventListener("DOMContentLoaded", function(event)
{
    loadAJAX(json_file, function(data)
    {
        //console.log(data);
        json = data;
        loadView("front");
        loadView("back");

    }, function(xhr) { console.error(xhr); });
});

function loadView(view)
{
    //console.log(json);

    if(view === "front")
    {
        var front = document.getElementsByClassName("front");
        var table = document.createElement("table");
        var tr = document.createElement("tr");
        
        while(front[0].children[0]) {
            front[0].children[0].parentNode.removeChild(front[0]);
        }

        for (i in json.dashboard)
        {
            json.dashboard[i].width = getWidth() * json.dashboard[i].width;
            json.dashboard[i].height = getHeight() * json.dashboard[i].height;

            if(json.dashboard[i].enabled)
            {
                console.log(json.dashboard[i].renderTo);

                switch (json.dashboard[i].renderTo) {
                    case "battery":
                    stream += ",udc";
                    break;
                case "speed":
                    stream += ",rpm";
                    break;
                }

                var td = document.createElement("td");
                var canvas = document.createElement("canvas");
                //canvas.style.cssText = "vertical-align: top";
                canvas.setAttribute("id", json.dashboard[i].renderTo);
                td.appendChild(canvas);
                tr.appendChild(td);

                dashboardVisible.push(json.dashboard[i]);
            }else{
                dashboardHidden.push(json.dashboard[i]);
            }
        }
        table.appendChild(tr);
        
        //var odometer = CANRead("distance");

        if(json.odometer)
        {
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.colSpan = dashboardVisible.length;

            var canvas = document.createElement("canvas");
            canvas.id = "odometer";
            canvas.height = 32;
            canvas.width = 200;

            td.appendChild(canvas);
            tr.appendChild(td);
            table.appendChild(tr);
        }
        
        var tr = document.createElement("tr");
        var td = buildAlertList(json,false,12);
        td.colSpan = dashboardVisible.length;

        tr.appendChild(td);
        table.appendChild(tr);
        front[0].appendChild(table);
        front[0].onclick = function () {
            //console.log(this);
            this.parentElement.style.cssText = "transform:rotateX(180deg); -webkit-transform:rotateX(180deg);";
        };

        for (i in dashboardVisible)
        {
            new RadialGauge(dashboardVisible[i]).draw();
        }

        if(json.odometer)
        {
            display = new SegmentDisplay("odometer",json.odometer);
            display.draw();
            display.setValue(json.odometer.count);
            //updateOdometer(json.odometer.count);
        }

        for (i in json.sounds)
        {
            if(json.sounds[i].play)
            {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "sounds/" + json.sounds[i].id, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = function(e){
                    window.addEventListener("keydown", createPitchStep(json.sounds[i].pitchStep))
                    window.addEventListener("keyup", createPitchStep(-json.sounds[i].pitchStep))
                    engineStart(this.response);
                };
                xhr.send();
                break;
            }
        }

    }else if (view === "back") {
    
        var divA = document.createElement("div");
        var divB = document.createElement("div");
        
        var back = document.getElementsByClassName("back");
        var table = document.createElement("table");

        var tr = document.createElement("tr");
        var td = document.createElement("td");
        divA.appendChild(buildGaugeList(dashboardHidden,"15%"));
        td.appendChild(divA);
        tr.appendChild(td);
        table.appendChild(tr);

        var tr = document.createElement("tr");
        var td = document.createElement("td");
        var t = document.createElement("table");
        divB.appendChild(buildGaugeList(dashboardVisible,"20%"));
        td.height="400";
        td.appendChild(divB);
        tr.appendChild(td);
        table.appendChild(tr);

        var tr = document.createElement("tr");
        var td = buildAlertList(json,true,20);
        td.height="300";
        tr.appendChild(td);
        table.appendChild(tr);

        [].forEach.call(divA.getElementsByClassName('tile__list'), function (el){
            Sortable.create(el, {
                group: 'photo',
                animation: 150,
                /*
                onChoose: function (evt) {
                    evt.item.setAttribute('width', "16%");
                },
                */
                onAdd: function (evt) {
                    //evt.from;
                    evt.item.setAttribute('width', "15%");
                    console.log(evt.item.id);
                }
            });
        });
        [].forEach.call(divB.getElementsByClassName('tile__list'), function (el){
            Sortable.create(el, {
                group: 'photo',
                animation: 150,
                /*
                onChoose: function (evt) {
                    evt.item.setAttribute('width', "24%");
                },
                */
                onAdd: function (evt) {
                    //evt.from;
                    evt.item.setAttribute('width', "20%");
                    console.log(evt.item.id);
                    console.log(evt.newIndex);
                },
                onUpdate: function (evt) {
                    console.log(evt.newIndex);
                }
            });
        });
        
        back[0].appendChild(table);
        back[0].onclick = function () {
            //console.log(this);
            this.parentElement.style.cssText = "";

            //TODO: Show visual effect
            saveView();
        };

    }

    var stream = "din_emcystop,din_ocur";

    //TODO: Detect idle mode and slow down stream

    document.gauges.forEach(function(gauge)
    {
        //console.log(gauge);

        gauge.value = gauge.options.maxValue;
        setTimeout(function()
        {
            gauge.value = gauge.options.minValue;
            //streamAJAX(stream);
            
        }, gauge.options.animationDuration*1.5);
    });

    new SVGInjector().inject(document.querySelectorAll("img.svg-inject"));
};

function saveView()
{
    //TODO:

};

function buildAlertList(json,showAll,size)
{
    var td = document.createElement("td");

    for (i in json.alerts)
    {
        //console.log(json.alerts[i].svg);
        if(json.alerts[i].enabled || showAll) {
            var span = document.createElement("span");
            var svg = document.createElement("img");
            var x = getWidth()/size/2;

            svg.id = json.alerts[i].id;
            svg.dataset.color = json.alerts[i].color;
            svg.classList.add("svg-inject");
            svg.classList.add("svg-grey");
            svg.style.width = getWidth()/size + "px";
            svg.style.height = getWidth()/size + "px";
            svg.src = "img/" + json.alerts[i].id + ".svg";
            //svg.setAttribute("data-fallback", "img/" + json.alerts[i].id + ".png");
            span.style.position = "relative"; 
            span.style.zIndex = "1";
            span.appendChild(svg);
            span.onclick = function (e) {
                //console.log(this);
                //console.log(this.children[1].src);
                e.preventDefault();
                e.stopPropagation();

                if(this.children[1].src.indexOf("disabled") !== -1)
                {
                    this.children[1].src = "img/enabled.svg";

                    if(this.children[0].id =="wifi")
                    {
                        var h = document.getElementById("lightboxTitle");
                        var b = document.getElementById("lightboxBody");

                        var email = document.createElement("input");
                        var smtp = document.createElement("input");
                        var username = document.createElement("input");
                        var password = document.createElement("input");
                        var save = document.createElement("button");

                        save.type = "submit";
                        save.innerHTML = "Save";
                        save.classList.add("btn");
                        save.classList.add("btn-primary");

                        b.innerHTML = "";
                        h.innerHTML = "WiFi";
                        email.type = "text";
                        smtp.type = "text";
                        username.type = "text";
                        password.type = "text";
                        email.classList.add("form-control");
                        email.classList.add("col-10");
                        email.setAttribute("value", "Email");
                        email.setAttribute("placeholder", "Email");

                        b.appendChild(email);
                        b.appendChild(smtp);
                        b.appendChild(username);
                        b.appendChild(password);
                        b.appendChild(save);

                        window.location = "#openModal";
                    }

                }else{
                    this.children[1].src = "img/disabled.svg";
                }
            };

            if(showAll)
            {
                var overlay = document.createElement("img");
                overlay.classList.add("svg-inject");
                if(json.alerts[i].enabled)
                {
                    overlay.src = "img/enabled.svg";
                }else{
                    overlay.src = "img/disabled.svg";
                }
                overlay.style.cssText = "position:relative;top:" + x + "px;left:-" + x + "px;width:" + x + "px;height:" + x + "px;";
                span.appendChild(overlay);
                //new SVGInjector().inject(overlay);
            }

            td.appendChild(span);
            //new SVGInjector().inject(svg);
        }
    }

    return td;
};

function buildGaugeList(array,size,title)
{
    var tile = document.createElement("div");
    tile.classList.add("tile");
    //tile.dataset.force = array.length;
    var tile_list = document.createElement("div");
    tile_list.classList.add("tile__list");

    if(title)
    {
        var tile_name = document.createElement("div");
        tile_name.classList.add("tile__name");
        tile_name.textContent = title;
        //tile_name.style.display = "none";
        tile.appendChild(tile_name);
    }
    
    var back = document.getElementsByClassName("back");
    var canvas = document.createElement("canvas");

    for (var i = 0; i < array.length; i++) {
        
        array[i].renderTo = "_" + array[i].renderTo;
        canvas.id = array[i].renderTo;

        back[0].appendChild(canvas);
        var gauge = new RadialGauge(array[i]).draw();
        back[0].removeChild(canvas);

        var ctx = canvas.getContext('2d');
        var img = document.createElement("img");
        img.src = canvas.toDataURL();
        img.id = array[i].renderTo;
        img.setAttribute('width', size);
        tile_list.appendChild(img);
    }
    canvas = null;

    tile.appendChild(tile_list);

    return tile;
};

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
                
                /*
                blink_emergency = setInterval(function() 
                {
                    var svg = document.getElementById("emergency");

                    if(svg.className.baseVal.indexOf(svg.dataset.color) !== -1) {
                        svg.classList.remove("svg-orange");
                        svg.classList.add("svg-grey");
                    }else{
                        svg.classList.remove("svg-grey");
                        svg.classList.add("svg-orange");
                    }
                    new SVGInjector().inject(svg);
                }, 1000);
                clearInterval(blink_emergency);
                */

                /*
                var svg = document.getElementById("battery");
                svg.classList.add(svg.dataset.color);
                new SVGInjector().inject(svg);
                */

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
	
	xhr.open('GET', "serial.php?stream=" + path, true);
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
    //xhr.setRequestHeader('Content-Type', 'application/json'); 
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
    odometer_count.setValue(n);
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