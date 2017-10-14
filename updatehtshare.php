<?php
/**
 * To the extent possible under law, the author(s) have dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/> for a copy of the
 * CC0 Public Domain Dedication.
**/

include('../connect.inc.php');

$result = mysqli_query($conn2, 'UPDATE ht_share SET lastrun = now() WHERE id = "'.$_GET['htid'].'"');
?>
