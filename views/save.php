<?php

	if(isset($_POST["view"]) && isset($_POST["json"]))
	{
	    $file = fopen($_POST["view"],"w") or die("Cannot open file: " .$_POST["view"]);
        fwrite($file, $_POST["json"]);
        fclose($file);
	}
    else if(isset($_POST["odometer"]))
    {

    }
?>