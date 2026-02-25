
const selected = document.querySelector(".selected");
const optionsContainer = document.querySelector(".options-container");

const optionsList = document.querySelectorAll(".option");


optionsList.forEach( o => {
  o.addEventListener("click", () => {
    selected.innerHTML = o.querySelector("label").innerHTML;
    optionsContainer.classList.remove("active");
  });
});

$(document).ready(function() {

  $('#agree-button').on('click', function() {
    $('#agreeHide').toggle();
  });
});

$(document).ready(function() {

  $('.form-control').on('click', function() {
    $('#contact-hide').hide();
  });
});



