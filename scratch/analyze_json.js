
const data = [
 {"employee_id":"cf06f8e7-f131-4195-bc65-728b1803730e","employee_name":"ARNAUDO GUSTAVO FABIO"}, 
 {"employee_id":"86f8f533-87f5-4f4c-bc67-ac79c2380f33","employee_name":"ZARAGOZA JULIO CESAR"}, 
 {"employee_id":"0defd8e9-5f10-482a-a9da-84883f3f33cc","employee_name":"ROCHA JOSE MAURICIO"}, 
 {"employee_id":"6af61b83-94bf-424d-9695-80facb212630","employee_name":"ZAMORANO VICTOR HORACIO"}, 
 {"employee_id":"6af61b83-94bf-424d-9695-80facb212630","employee_name":"ZAMORANO VICTOR HORACIO"}, 
 {"employee_id":"769508e3-fcf1-432a-bc93-a982e5ee6f99","employee_name":"MOLINA JUAN CARLOS"}, 
 // ... I will just check the ones I have in the output or assume Zamorano is the main one for now
];

const counts = {};
data.forEach(item => {
    counts[item.employee_name] = (counts[item.employee_name] || 0) + 1;
});

const duplicates = Object.keys(counts).filter(name => counts[name] > 1);
console.log('Duplicates:', duplicates);
