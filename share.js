$(document).ready(function() {

    $('html').on('click','.edit',function(e){
        e.preventDefault();
        var tagfield = $(this).parent().find('span');
        var tags = tagfield.html().replace(/<br>/g, '\n');
        tagfield.html('<textarea>'+tags+'</textarea>');
        $(this).attr('src', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/OOjs_UI_icon_check.svg/24px-OOjs_UI_icon_check.svg.png');
        $(this).attr('alt', 'save');
        $(this).attr('class', 'save');
    });

    $('html').on('click','.save',function(e){
        e.preventDefault();
        var tagfield = $(this).parent().find('span');
        var newtags = tagfield.find('textarea').val().replace(/\n/g, '<br>');
        $.get('share.php?action=edit&tags='+newtags+'&id='+$(this).parent().parent().attr('data-id'));
        tagfield.html(newtags);
        $(this).attr('src', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/OOjs_UI_icon_edit-ltr.svg/24px-OOjs_UI_icon_edit-ltr.svg.png');
        $(this).attr('alt', 'edit');
        $(this).attr('class', 'edit');
    });

    $('html').on('click','.delete',function(e){
            $(this).load('share.php?action=delete&id='+$(this).parent().parent().attr('data-id'));
            $(this).parent().parent().remove();
    });

});